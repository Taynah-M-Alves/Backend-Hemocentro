import { idValido } from './validacao.js';

const LIMITE_PADRAO = 20;
const LIMITE_MAXIMO = 100;

export interface Paginacao {
  pagina: number;
  limite: number;
  skip: number;
  take: number;
}

/** ?pagina=1&limite=20 → valores para o Prisma (skip/take). Limite máximo: 100. */
export function paginacao(pagina?: string, limite?: string): Paginacao {
  const p = pagina ? idValido(pagina, 'pagina') : 1;
  const l = Math.min(
    limite ? idValido(limite, 'limite') : LIMITE_PADRAO,
    LIMITE_MAXIMO,
  );
  return { pagina: p, limite: l, skip: (p - 1) * l, take: l };
}

/** Formato padrão das listas: { itens, total, pagina, limite }. */
export const paginado = <T>(itens: T[], total: number, p: Paginacao) => ({
  itens,
  total,
  pagina: p.pagina,
  limite: p.limite,
});
