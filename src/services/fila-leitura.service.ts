import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import * as path from 'path';
import { UPLOADS_DIR } from '../config/upload.config.js';
import type { Prisma } from '../generated/prisma/client.js';
import { StatusFicha } from '../generated/prisma/enums.js';
import { mensagemDeErro } from '../utils/erros.js';
import { AiExtractionService, FalhaLeituraError } from './ai-extraction.service.js';
import { DocumentoImagemService } from './documento-imagem.service.js';
import { PacienteService } from './paciente.service.js';
import { PrismaService } from './prisma.service.js';

/** De quanto em quanto tempo a fila procura fichas novas (além do aviso logo após o upload). */
const INTERVALO_MS = 5_000;
/** Espera antes de cada nova tentativa automática após falha passageira: 1, 5 e 15 min. */
const ESPERAS_MS = [60_000, 5 * 60_000, 15 * 60_000];

/**
 * Fila da IA: lê as fichas em segundo plano, uma por vez. A fila é o próprio banco
 * (fichas em ENVIADA cuja próxima tentativa já chegou), então nada se perde ao reiniciar.
 */
@Injectable()
export class FilaLeituraService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(FilaLeituraService.name);
  private timer?: NodeJS.Timeout;
  private ocupada = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly imagens: DocumentoImagemService,
    private readonly ia: AiExtractionService,
    private readonly pacientes: PacienteService,
  ) {}

  async onApplicationBootstrap() {
    // Fichas que estavam sendo lidas quando o servidor caiu voltam para a fila
    const { count } = await this.prisma.fichaDigitalizada.updateMany({
      where: { status: StatusFicha.LENDO },
      data: { status: StatusFicha.ENVIADA },
    });
    if (count) this.logger.warn(`${count} ficha(s) em LENDO voltaram para a fila.`);

    this.timer = setInterval(() => void this.processar(), INTERVALO_MS);
    void this.processar();
  }

  onApplicationShutdown() {
    clearInterval(this.timer);
  }

  /** Lê fichas até a fila esvaziar. Chamar de novo enquanto roda não faz nada. */
  async processar(): Promise<void> {
    if (this.ocupada) return;
    this.ocupada = true;
    try {
      while (await this.lerProxima());
    } catch (err) {
      this.logger.error(`Fila parou: ${mensagemDeErro(err)}`);
    } finally {
      this.ocupada = false;
    }
  }

  /** Devolve false quando não há ficha esperando. */
  private async lerProxima(): Promise<boolean> {
    // Marca LENDO e trava a linha na mesma operação: duas cópias do servidor nunca leem a mesma ficha
    const [proxima] = await this.prisma.$queryRaw<{ id: number }[]>`
      UPDATE ficha_digitalizada SET status = 'LENDO'
      WHERE id = (
        SELECT id FROM ficha_digitalizada
        WHERE status = 'ENVIADA'
          -- As colunas são "timestamp" gravadas em UTC pelo Prisma; now() viria no fuso do banco
          AND (proxima_tentativa_em IS NULL OR proxima_tentativa_em <= (now() AT TIME ZONE 'UTC'))
        ORDER BY criado_em, id
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id`;
    if (!proxima) return false;

    const ficha = await this.prisma.fichaDigitalizada.findUniqueOrThrow({
      where: { id: proxima.id },
      include: { documento: true },
    });
    const alvo = {
      fichaId: ficha.id,
      documentoId: ficha.documentoId,
      loteId: ficha.documento.loteId,
    };

    try {
      const paginas = await this.imagens.paraImagens(
        path.join(UPLOADS_DIR, ficha.documento.chave),
        ficha.documento.mimeType,
      );
      const { dados, provedor } = await this.ia.extrairFicha(paginas);
      const [sugerido] = await this.pacientes.semelhantes(dados.paciente);

      await this.prisma.$transaction([
        this.prisma.fichaDigitalizada.update({
          where: { id: ficha.id },
          data: {
            status: StatusFicha.AGUARDANDO_REVISAO,
            dadosExtraidos: dados as unknown as Prisma.InputJsonValue,
            pacienteSugeridoId: sugerido?.id ?? null,
            erroLeitura: null,
            proximaTentativaEm: null,
          },
        }),
        this.prisma.documento.update({
          where: { id: ficha.documentoId },
          data: { totalPaginas: paginas.length, provedorIa: provedor },
        }),
        this.prisma.eventoAuditoria.create({
          data: { tipo: 'LEITURA_CONCLUIDA', ...alvo, valorPosterior: provedor },
        }),
      ]);
      this.logger.log(`Ficha ${ficha.id} lida (${provedor}).`);
    } catch (err) {
      await this.registrarFalha(ficha, alvo, err);
    }
    return true;
  }

  /**
   * Falha passageira (sobrecarga, rede, tempo esgotado) volta sozinha para a fila, até 3 vezes.
   * Falha definitiva (PDF corrompido, nome ilegível para todas as IAs, sem chave) ou a 4ª
   * falha vai para FALHA_LEITURA, que só sai por reprocessamento manual.
   */
  private async registrarFalha(
    ficha: { id: number; tentativasLeitura: number },
    alvo: { fichaId: number; documentoId: number; loteId: number },
    err: unknown,
  ) {
    const motivo = mensagemDeErro(err);
    const tentativas = ficha.tentativasLeitura + 1;
    const espera =
      err instanceof FalhaLeituraError && err.transitoria
        ? ESPERAS_MS[tentativas - 1]
        : undefined;

    await this.prisma.$transaction([
      this.prisma.fichaDigitalizada.update({
        where: { id: ficha.id },
        data: espera
          ? {
              status: StatusFicha.ENVIADA,
              tentativasLeitura: tentativas,
              proximaTentativaEm: new Date(Date.now() + espera),
            }
          : {
              status: StatusFicha.FALHA_LEITURA,
              tentativasLeitura: tentativas,
              erroLeitura: motivo,
              proximaTentativaEm: null,
            },
      }),
      this.prisma.eventoAuditoria.create({
        data: { tipo: 'LEITURA_FALHOU', ...alvo, justificativa: motivo },
      }),
    ]);
    this.logger.error(
      `Ficha ${ficha.id}: ${motivo} ${espera ? `Nova tentativa em ${espera / 60_000} min.` : '→ FALHA_LEITURA'}`,
    );
  }
}
