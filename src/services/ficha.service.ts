import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  STATUS_REVISAO,
  type AlterarDadosDto,
  type AprovarFichaDto,
  type AssumirRevisaoDto,
  type FiltroFichasDto,
  type PendenciaDto,
} from '../dtos/ficha.dto.js';
import type { Prisma } from '../generated/prisma/client.js';
import { StatusFicha } from '../generated/prisma/enums.js';
import type { FichaExtraida } from '../types/ficha.types.js';
import { mensagemDeErro } from '../utils/erros.js';
import {
  camposFaltandoNaTransfusao,
  dataIso,
  exigirIdentificacao,
  sanitizarFicha,
} from '../utils/ficha-sanitize.js';
import { gravarCaminho, lerCaminho, partesDoCaminho } from '../utils/caminho.js';
import { codigoFicha, codigoLote, dataSemHora, paraData } from '../utils/formatos.js';
import { paginado } from '../utils/paginacao.js';
import { FichaPersistenciaService } from './ficha-persistencia.service.js';
import { PacienteService } from './paciente.service.js';
import { PrismaService } from './prisma.service.js';
import { UsuarioService } from './usuario.service.js';

type Alerta =
  | 'NASCIMENTO_AUSENTE'
  | 'CAMPOS_OBRIGATORIOS_AUSENTES'
  | 'POSSIVEL_DUPLICIDADE';

const DETALHE = {
  documento: true,
  revisor: { select: { id: true, nome: true } },
  validadoPor: { select: { id: true, nome: true } },
  pacienteSugerido: true,
} as const;

type FichaComDetalhe = Prisma.FichaDigitalizadaGetPayload<{ include: typeof DETALHE }>;

/**
 * Fila de revisão e Revisar ficha. Enquanto não é aprovada, a leitura da IA fica só em
 * dadosExtraidos; aprovar é a única ação que grava nas tabelas clínicas.
 * Ação fora da ordem do fluxo de status responde 409.
 */
@Injectable()
export class FichaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usuarios: UsuarioService,
    private readonly pacientes: PacienteService,
    private readonly persistencia: FichaPersistenciaService,
  ) {}

  // shortcut: filtra a busca e ordena por alerta em memória (os alertas vêm do JSON lido);
  // serve para as ~850 fichas do acervo. Se passar de dezenas de milhares, mover para SQL.
  async listar(dto: FiltroFichasDto) {
    const [fichas, porStatus] = await Promise.all([
      this.prisma.fichaDigitalizada.findMany({
        where: {
          status: { in: dto.status },
          ...(dto.loteId && { documento: { loteId: dto.loteId } }),
          ...(dto.revisorId && { revisorId: dto.revisorId }),
        },
        orderBy: { criadoEm: 'desc' },
        include: {
          documento: { select: { loteId: true } },
          revisor: { select: { id: true, nome: true } },
        },
      }),
      this.prisma.fichaDigitalizada.groupBy({
        by: ['status'],
        where: { status: { in: dto.escopo } },
        _count: true,
      }),
    ]);

    let itens = fichas.map((f) => {
      const dados = f.dadosExtraidos as FichaExtraida | null;
      return {
        id: f.id,
        codigo: codigoFicha(f.id),
        status: f.status,
        paciente: dados && {
          nome: dados.paciente.nome,
          dataNascimento: dados.paciente.dataNascimento,
          nomeMae: dados.paciente.nomeMae,
        },
        lote: { id: f.documento.loteId, codigo: codigoLote(f.documento.loteId) },
        revisor: f.revisor,
        desde: f.revisaoIniciadaEm ?? f.criadoEm,
        alertas: alertas(dados, f.pacienteSugeridoId),
      };
    });

    if (dto.busca) {
      const termo = semAcento(dto.busca);
      const data = dataIso(dto.busca);
      itens = itens.filter(
        ({ paciente: p }) =>
          !!p &&
          (semAcento(p.nome ?? '').includes(termo) ||
            semAcento(p.nomeMae ?? '').includes(termo) ||
            (!!data && p.dataNascimento === data)),
      );
    }
    if (dto.ordenar === 'atencao') {
      // Com alerta primeiro; entre elas, as que esperam há mais tempo
      itens.sort(
        (a, b) =>
          b.alertas.length - a.alertas.length || a.desde.getTime() - b.desde.getTime(),
      );
    } else if (dto.ordenar === 'pendencias') {
      // COM_PENDENCIA → EM_REVISAO → AGUARDANDO_REVISAO → VALIDADA; outros status no fim.
      // O sort é estável, então dentro de cada status segue a mais recente primeiro.
      itens.sort((a, b) => prioridade(a.status) - prioridade(b.status));
    }

    const contagem = Object.fromEntries(porStatus.map((s) => [s.status, s._count]));
    const { skip, take } = dto.paginacao;
    return {
      contadores: {
        todas: porStatus
          .filter((s) => s.status !== StatusFicha.VALIDADA)
          .reduce((soma, s) => soma + s._count, 0),
        ...contagem,
      },
      ...paginado(itens.slice(skip, skip + take), itens.length, dto.paginacao),
    };
  }

  async detalhe(id: number) {
    return this.formatar(await this.carregar(id));
  }

  /** AGUARDANDO_REVISAO ou COM_PENDENCIA → EM_REVISAO, com quem chamou como revisor. */
  async iniciarRevisao(id: number, usuarioId: number) {
    const usuario = await this.usuarios.exigirAtivo(usuarioId);
    const ficha = await this.carregar(id);
    const livres: StatusFicha[] = [StatusFicha.AGUARDANDO_REVISAO, StatusFicha.COM_PENDENCIA];
    if (!livres.includes(ficha.status)) throw foraDeOrdem(ficha, 'iniciar a revisão');

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.fichaDigitalizada.updateMany({
        where: { id, status: { in: livres } },
        data: {
          status: StatusFicha.EM_REVISAO,
          revisorId: usuario.id,
          revisaoIniciadaEm: new Date(),
        },
      });
      if (!count) throw new ConflictException('Outra pessoa iniciou esta revisão agora há pouco.');
      await tx.eventoAuditoria.create({
        data: { tipo: 'REVISAO_INICIADA', ...this.alvo(ficha), usuarioId: usuario.id },
      });
    });
    return { id, status: StatusFicha.EM_REVISAO, revisor: usuario };
  }

  /** Tira a ficha de quem está revisando e passa para quem chamou. */
  async assumirRevisao(id: number, usuarioId: number, dto: AssumirRevisaoDto) {
    const usuario = await this.usuarios.exigirAtivo(usuarioId);
    const ficha = await this.carregar(id);
    if (ficha.status !== StatusFicha.EM_REVISAO) {
      throw foraDeOrdem(ficha, 'assumir a revisão (use "iniciar-revisao" numa ficha livre)');
    }
    if (ficha.revisorId === usuario.id) {
      throw new ConflictException('Esta revisão já é sua.');
    }

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.fichaDigitalizada.updateMany({
        where: { id, status: StatusFicha.EM_REVISAO, revisorId: ficha.revisorId },
        data: { revisorId: usuario.id, revisaoIniciadaEm: new Date() },
      });
      if (!count) throw new ConflictException('A revisão mudou de mãos agora há pouco. Recarregue a ficha.');
      await tx.eventoAuditoria.create({
        data: {
          tipo: 'REVISAO_ASSUMIDA',
          ...this.alvo(ficha),
          usuarioId: usuario.id,
          valorAnterior: ficha.revisor?.nome ?? null,
          valorPosterior: usuario.nome,
          justificativa: dto.justificativa,
        },
      });
    });
    return { id, status: StatusFicha.EM_REVISAO, revisor: usuario, revisorAnterior: ficha.revisor };
  }

  /** Salva correções no rascunho. Cada campo alterado vira um CAMPO_EDITADO na auditoria. */
  async alterarDados(id: number, usuarioId: number, dto: AlterarDadosDto) {
    await this.usuarios.exigirAtivo(usuarioId);
    const ficha = await this.carregar(id);
    exigirRevisor(ficha, usuarioId);

    const original = ficha.dadosExtraidos as unknown as FichaExtraida;
    let dados = structuredClone(original);
    const eventos: Prisma.EventoAuditoriaCreateManyInput[] = [];

    for (const a of dto.alteracoes) {
      const partes = partesDoCaminho(a.campo);
      const anterior = lerCaminho(dados, partes);
      gravarCaminho(dados, partes, a.valor);
      // Converte para os tipos do banco; valor que não se encaixa no campo vira null
      dados = sanitizarFicha(dados);

      const gravado = lerCaminho(dados, partes);
      const ehItemInteiro = typeof a.valor === 'object' && a.valor !== null;
      if (a.valor !== null && !ehItemInteiro && (gravado === null || gravado === undefined)) {
        throw new BadRequestException(
          `Valor inválido para "${a.campo}": ${JSON.stringify(a.valor)}.`,
        );
      }
      eventos.push({
        tipo: 'CAMPO_EDITADO',
        ...this.alvo(ficha),
        usuarioId,
        campo: a.campo,
        pagina: a.pagina,
        valorAnterior: comoTexto(anterior),
        valorPosterior: comoTexto(gravado),
        justificativa: a.justificativa,
      });
    }

    const invalidas = await this.persistencia.referenciasInvalidas(this.prisma, dados, original);
    if (invalidas.length) throw new BadRequestException(invalidas.join(' '));

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.fichaDigitalizada.updateMany({
        where: { id, status: StatusFicha.EM_REVISAO, revisorId: usuarioId },
        data: { dadosExtraidos: dados as unknown as Prisma.InputJsonValue },
      });
      if (!count) throw new ConflictException('A ficha mudou de revisor ou de status. Recarregue a ficha.');
      await tx.eventoAuditoria.createMany({ data: eventos });
    });
    return this.detalhe(id);
  }

  /** EM_REVISAO → COM_PENDENCIA, com o motivo na auditoria. */
  async sinalizarPendencia(id: number, usuarioId: number, dto: PendenciaDto) {
    await this.usuarios.exigirAtivo(usuarioId);
    const ficha = await this.carregar(id);
    exigirRevisor(ficha, usuarioId);

    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.fichaDigitalizada.updateMany({
        where: { id, status: StatusFicha.EM_REVISAO, revisorId: usuarioId },
        data: { status: StatusFicha.COM_PENDENCIA, revisorId: null, revisaoIniciadaEm: null },
      });
      if (!count) throw new ConflictException('A ficha mudou de revisor ou de status. Recarregue a ficha.');
      await tx.eventoAuditoria.create({
        data: {
          tipo: 'PENDENCIA_SINALIZADA',
          ...this.alvo(ficha),
          usuarioId,
          justificativa: dto.motivo,
        },
      });
    });
    return { id, status: StatusFicha.COM_PENDENCIA };
  }

  /**
   * Valida a ficha e grava paciente, transfusões, pesquisas e kits numa transação só.
   * Com pacienteId, liga a ficha a esse paciente; sem ele, cria um paciente novo.
   */
  async aprovar(id: number, usuarioId: number, dto: AprovarFichaDto) {
    const usuario = await this.usuarios.exigirAtivo(usuarioId);
    const ficha = await this.carregar(id);
    exigirRevisor(ficha, usuarioId);

    const dados = ficha.dadosExtraidos as unknown as FichaExtraida;
    try {
      exigirIdentificacao(dados);
    } catch (err) {
      throw new UnprocessableEntityException(`${mensagemDeErro(err)} Corrija antes de aprovar.`);
    }
    const invalidas = await this.persistencia.referenciasInvalidas(this.prisma, dados);
    if (invalidas.length) {
      throw new UnprocessableEntityException(`${invalidas.join(' ')} Corrija antes de aprovar.`);
    }
    const identificado = dados as FichaExtraida & {
      paciente: { nome: string; dataNascimento: string };
    };
    const { prontuario } = dados.paciente;
    if (!dto.pacienteId && prontuario) {
      const existente = await this.prisma.paciente.findUnique({ where: { prontuario } });
      if (existente) {
        throw new ConflictException(
          `Já existe o paciente ${existente.nome} com o prontuário ${prontuario}. Envie "pacienteId": "${existente.id}" para ligar a ficha a ele.`,
        );
      }
    }

    const validadoEm = new Date();
    const { resumo, avisos } = await this.prisma.$transaction(
      async (tx) => {
        const gravacao = await this.persistencia.salvar(tx, identificado, id, dto.pacienteId);
        const { count } = await tx.fichaDigitalizada.updateMany({
          where: { id, status: StatusFicha.EM_REVISAO, revisorId: usuarioId },
          data: {
            status: StatusFicha.VALIDADA,
            pacienteId: gravacao.resumo.pacienteId,
            dataAtendimento: dados.dataAtendimento && paraData(dados.dataAtendimento),
            motivo: dados.motivo,
            validadoPorId: usuarioId,
            validadoEm,
          },
        });
        if (!count) throw new ConflictException('A ficha mudou de revisor ou de status. Recarregue a ficha.');

        const alvo = { ...this.alvo(ficha), usuarioId, pacienteId: gravacao.resumo.pacienteId };
        await tx.eventoAuditoria.createMany({
          data: [
            { tipo: 'FICHA_VALIDADA', ...alvo },
            ...(dto.pacienteId ? [{ tipo: 'VINCULO_CONFIRMADO' as const, ...alvo }] : []),
          ],
        });
        return gravacao;
      },
      { timeout: 30_000 },
    );

    return {
      id,
      status: StatusFicha.VALIDADA,
      validadoPor: usuario,
      validadoEm,
      gravacao: resumo,
      avisos,
    };
  }

  /** Pacientes já cadastrados parecidos com o paciente lido na ficha. */
  async semelhantes(id: number) {
    const ficha = await this.carregar(id);
    const dados = ficha.dadosExtraidos as FichaExtraida | null;
    return dados ? this.pacientes.semelhantes(dados.paciente) : [];
  }

  // ── Apoio ─────────────────────────────────────────────────────────────────

  private async carregar(id: number): Promise<FichaComDetalhe> {
    const ficha = await this.prisma.fichaDigitalizada.findUnique({
      where: { id },
      include: DETALHE,
    });
    if (!ficha) throw new NotFoundException(`Ficha ${id} não encontrada.`);
    return ficha;
  }

  /** Ligações do evento de auditoria com a ficha, o documento e o lote. */
  private alvo(ficha: FichaComDetalhe) {
    return { fichaId: ficha.id, documentoId: ficha.documentoId, loteId: ficha.documento.loteId };
  }

  private formatar(f: FichaComDetalhe) {
    const dados = f.dadosExtraidos as FichaExtraida | null;
    const s = f.pacienteSugerido;
    return {
      id: f.id,
      codigo: codigoFicha(f.id),
      status: f.status,
      provedorIa: f.documento.provedorIa,
      erroLeitura: f.erroLeitura,
      documento: {
        id: f.documento.id,
        nomeOriginal: f.documento.nomeOriginal,
        totalPaginas: f.documento.totalPaginas,
        url: `/api/documentos/${f.documento.id}/arquivo`,
      },
      lote: { id: f.documento.loteId, codigo: codigoLote(f.documento.loteId) },
      revisor: f.revisor,
      revisaoIniciadaEm: f.revisaoIniciadaEm,
      dados,
      pacienteSugerido: s && {
        id: s.id,
        nome: s.nome,
        dataNascimento: dataSemHora(s.dataNascimento),
        nomeMae: s.nomeMae,
      },
      pacienteId: f.pacienteId,
      validadoPor: f.validadoPor,
      validadoEm: f.validadoEm,
      alertas: alertas(dados, f.pacienteSugeridoId),
    };
  }
}

// ── Regras ────────────────────────────────────────────────────────────────────

/** Calculados a partir da leitura; ordenar=atencao coloca primeiro quem tem alerta. */
function alertas(dados: FichaExtraida | null, pacienteSugeridoId: string | null): Alerta[] {
  if (!dados) return [];
  const faltaObrigatorio =
    !dados.paciente.nome ||
    dados.transfusoes.some((t) => camposFaltandoNaTransfusao(t).length > 0) ||
    dados.pesquisas.some((p) => !p.dataPesquisa) ||
    dados.kits.some((k) => !k.tipo || !k.dataPesquisa);
  return [
    !dados.paciente.dataNascimento && ('NASCIMENTO_AUSENTE' as const),
    faltaObrigatorio && ('CAMPOS_OBRIGATORIOS_AUSENTES' as const),
    !!pacienteSugeridoId && ('POSSIVEL_DUPLICIDADE' as const),
  ].filter((a): a is Alerta => !!a);
}

/** Regra de dono: em EM_REVISAO, só o revisor atual pode salvar, sinalizar ou aprovar. */
function exigirRevisor(ficha: FichaComDetalhe, usuarioId: number): void {
  if (ficha.status !== StatusFicha.EM_REVISAO) {
    throw foraDeOrdem(ficha, 'alterar (inicie a revisão primeiro)');
  }
  if (ficha.revisorId !== usuarioId) {
    throw new ConflictException(
      `A ficha está em revisão por ${ficha.revisor?.nome ?? 'outra pessoa'}. Use "assumir-revisao" para continuar.`,
    );
  }
}

const foraDeOrdem = (ficha: { id: number; status: StatusFicha }, acao: string) =>
  new ConflictException(
    `A ficha ${codigoFicha(ficha.id)} está em ${ficha.status}; não é possível ${acao}.`,
  );

const prioridade = (status: StatusFicha) => {
  const i = STATUS_REVISAO.indexOf(status);
  return i < 0 ? STATUS_REVISAO.length : i;
};

const semAcento = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Valor de um campo como texto para a auditoria (null = vazio). */
const comoTexto = (v: unknown) =>
  v === null || v === undefined ? null : typeof v === 'string' ? v : JSON.stringify(v);
