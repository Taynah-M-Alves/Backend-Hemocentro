import { BadRequestException } from '@nestjs/common';
import { StatusFicha } from '../generated/prisma/enums.js';
import { paginacao, type Paginacao } from '../utils/paginacao.js';
import {
  corpo,
  idDaQuery,
  idOpcional,
  textoObrigatorio,
  textoOpcional,
  umDe,
  uuidOpcional,
} from '../utils/validacao.js';

const STATUS = Object.values(StatusFicha);
const ORDENS = ['recentes', 'atencao', 'pendencias'] as const;

/** GET /api/fichas/revisao — também é a ordem de ordenar=pendencias */
export const STATUS_REVISAO: StatusFicha[] = [
  StatusFicha.COM_PENDENCIA,
  StatusFicha.EM_REVISAO,
  StatusFicha.AGUARDANDO_REVISAO,
  StatusFicha.VALIDADA,
];

/** GET /api/fichas */
export interface FiltroFichasDto {
  /** Padrão: todos menos VALIDADA */
  status: StatusFicha[];
  /** Status que a rota mostra; limita também os contadores */
  escopo: StatusFicha[];
  loteId?: number;
  revisorId?: number;
  /** Nome, nascimento ou nome da mãe */
  busca?: string;
  /** atencao = fichas com alerta primeiro; pendencias = na ordem de STATUS_REVISAO */
  ordenar: (typeof ORDENS)[number];
  paginacao: Paginacao;
}

/** Uma correção da revisão. `campo` é o caminho no dado lido, ex.: "transfusoes[1].volMl". */
export interface AlteracaoDto {
  campo: string;
  valor: unknown;
  pagina: number | null;
  justificativa: string | null;
}

/** PATCH /api/fichas/:id/dados */
export interface AlterarDadosDto {
  alteracoes: AlteracaoDto[];
}

/** POST /api/fichas/:id/pendencia */
export interface PendenciaDto {
  motivo: string;
}

/** POST /api/fichas/:id/assumir-revisao */
export interface AssumirRevisaoDto {
  justificativa: string | null;
}

/** POST /api/fichas/:id/aprovar — sem pacienteId, cria um paciente novo */
export interface AprovarFichaDto {
  pacienteId: string | null;
}

/** `permitidos` limita os status aceitos; sem "status" na query, traz todos eles. */
export function lerFiltroFichasDto(
  q: Record<string, string | undefined>,
  permitidos?: StatusFicha[],
): FiltroFichasDto {
  const status = q.status
    ? q.status.split(',').map((s) => umDe(s.trim(), permitidos ?? STATUS, 'status'))
    : (permitidos ?? STATUS.filter((s) => s !== StatusFicha.VALIDADA));
  return {
    status,
    escopo: permitidos ?? STATUS,
    loteId: idDaQuery(q.loteId, 'loteId'),
    revisorId: idDaQuery(q.revisorId, 'revisorId'),
    busca: q.busca?.trim() || undefined,
    ordenar: q.ordenar ? umDe(q.ordenar, ORDENS, 'ordenar') : 'recentes',
    paginacao: paginacao(q.pagina, q.limite),
  };
}

export function lerAlterarDadosDto(body: unknown): AlterarDadosDto {
  const { alteracoes } = corpo(body);
  if (!Array.isArray(alteracoes) || alteracoes.length === 0) {
    throw new BadRequestException('"alteracoes" precisa ser uma lista com pelo menos um item.');
  }
  return {
    alteracoes: alteracoes.map((item: unknown, i) => {
      const c = corpo(item);
      if (!('valor' in c)) {
        throw new BadRequestException(`alteracoes[${i}]: "valor" é obrigatório (use null para apagar).`);
      }
      return {
        campo: textoObrigatorio(c, 'campo', 100),
        valor: c.valor,
        pagina: idOpcional(c, 'pagina') ?? null,
        justificativa: textoOpcional(c, 'justificativa', 2000) ?? null,
      };
    }),
  };
}

export const lerPendenciaDto = (body: unknown): PendenciaDto => ({
  motivo: textoObrigatorio(corpo(body), 'motivo', 2000),
});

export const lerAssumirRevisaoDto = (body: unknown): AssumirRevisaoDto => ({
  justificativa: textoOpcional(corpo(body ?? {}), 'justificativa', 2000) ?? null,
});

export const lerAprovarFichaDto = (body: unknown): AprovarFichaDto => ({
  pacienteId: uuidOpcional(corpo(body ?? {}), 'pacienteId') ?? null,
});
