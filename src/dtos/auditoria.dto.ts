import { TipoEvento } from '../generated/prisma/enums.js';
import { paginacao, type Paginacao } from '../utils/paginacao.js';
import { dataDaQuery, idDaQuery, umDe, uuidOpcional } from '../utils/validacao.js';

/** Filtros de GET /api/auditoria/eventos (e da exportação, sem paginação). */
export interface FiltroEventosDto {
  /** "FIC-0320", "DEM-012" ou parte do nome do paciente */
  busca?: string;
  de?: string;
  ate?: string;
  tipo?: TipoEvento;
  usuarioId?: number;
  fichaId?: number;
  pacienteId?: string;
  paginacao: Paginacao;
}

export function lerFiltroEventosDto(
  q: Record<string, string | undefined>,
): FiltroEventosDto {
  return {
    busca: q.busca?.trim() || undefined,
    de: dataDaQuery(q.de, 'de'),
    ate: dataDaQuery(q.ate, 'ate'),
    tipo: q.tipo ? umDe(q.tipo, Object.values(TipoEvento), 'tipo') : undefined,
    usuarioId: idDaQuery(q.usuarioId, 'usuarioId'),
    fichaId: idDaQuery(q.fichaId, 'fichaId'),
    pacienteId: uuidOpcional(q, 'pacienteId'),
    paginacao: paginacao(q.pagina, q.limite),
  };
}

/** GET /api/dashboard — período (padrão: últimas 6 semanas). */
export interface PeriodoDto {
  de?: string;
  ate?: string;
}

export const lerPeriodoDto = (q: Record<string, string | undefined>): PeriodoDto => ({
  de: dataDaQuery(q.de, 'de'),
  ate: dataDaQuery(q.ate, 'ate'),
});
