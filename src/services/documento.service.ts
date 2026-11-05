import {
  ConflictException,
  Injectable,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { UPLOADS_DIR } from '../config/upload.config.js';
import { StatusFicha } from '../generated/prisma/enums.js';
import { codigoFicha, dataHoraLocal } from '../utils/formatos.js';
import { FilaLeituraService } from './fila-leitura.service.js';
import { PrismaService } from './prisma.service.js';
import { UsuarioService } from './usuario.service.js';

/** Tempo mínimo entre a falha da IA (falhouEm) e o reprocessar: 5 min. */
const ESPERA_REPROCESSAR_MS = 5 * 60_000;

@Injectable()
export class DocumentoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usuarios: UsuarioService,
    private readonly fila: FilaLeituraService,
  ) {}

  /** O arquivo original, nunca por link público. Grava CONSULTA (quem abriu). */
  async arquivo(id: number, usuarioId: number | null): Promise<StreamableFile> {
    const doc = await this.encontrar(id);
    const caminho = path.join(UPLOADS_DIR, doc.chave);
    if (!fs.existsSync(caminho)) {
      throw new NotFoundException(`O arquivo do documento ${id} não está mais no servidor.`);
    }
    if (usuarioId !== null) await this.usuarios.exigirAtivo(usuarioId);
    await this.prisma.eventoAuditoria.create({
      data: {
        tipo: 'CONSULTA',
        usuarioId,
        documentoId: id,
        loteId: doc.loteId,
        fichaId: doc.ficha?.id,
        pacienteId: doc.ficha?.pacienteId,
      },
    });
    return new StreamableFile(fs.createReadStream(caminho), {
      type: doc.mimeType,
      disposition: `inline; filename*=UTF-8''${encodeURIComponent(doc.nomeOriginal)}`,
    });
  }

  /** FALHA_LEITURA → ENVIADA, 5 min após a falha, zerando as tentativas. A fila lê de novo em seguida. */
  async reprocessar(id: number, usuarioId: number) {
    await this.usuarios.exigirAtivo(usuarioId);
    const doc = await this.encontrar(id);
    const ficha = doc.ficha;
    if (ficha?.status !== StatusFicha.FALHA_LEITURA) {
      throw new ConflictException(
        `Só dá para reprocessar uma ficha em FALHA_LEITURA${ficha ? `; ${codigoFicha(ficha.id)} está em ${ficha.status}` : ''}.`,
      );
    }
    const liberaEm = (ficha.falhouEm?.getTime() ?? 0) + ESPERA_REPROCESSAR_MS;
    if (Date.now() < liberaEm) {
      throw new ConflictException(
        `Aguarde 5 minutos após a falha para reprocessar (liberado em ${dataHoraLocal(new Date(liberaEm))}).`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.fichaDigitalizada.update({
        where: { id: ficha.id },
        data: {
          status: StatusFicha.ENVIADA,
          tentativasLeitura: 0,
          proximaTentativaEm: null,
          erroLeitura: null,
          falhouEm: null,
        },
      }),
      this.prisma.eventoAuditoria.create({
        data: {
          tipo: 'REPROCESSAMENTO',
          usuarioId,
          documentoId: id,
          loteId: doc.loteId,
          fichaId: ficha.id,
          valorAnterior: ficha.erroLeitura,
        },
      }),
    ]);
    void this.fila.processar();
    return { fichaId: ficha.id, status: StatusFicha.ENVIADA };
  }

  private async encontrar(id: number) {
    const doc = await this.prisma.documento.findUnique({
      where: { id },
      include: { ficha: true },
    });
    if (!doc) throw new NotFoundException(`Documento ${id} não encontrado.`);
    return doc;
  }
}
