// Conversões usadas pelas rotas: códigos de exibição, datas e buscas no Prisma.

/** Lote DEM-012, ficha FIC-0320, evento EVT-0094 (prefixo + id). */
export const codigoLote = (id: number) => `DEM-${String(id).padStart(3, '0')}`;
export const codigoFicha = (id: number) => `FIC-${String(id).padStart(4, '0')}`;
export const codigoEvento = (id: number) =>
  `EVT-${String(id).padStart(4, '0')}`;

/** "2026-05-05" → Date (as colunas de data são @db.Date, só dia/mês/ano). */
export const paraData = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Date de uma coluna @db.Date → "AAAA-MM-DD". */
export function dataSemHora(data: Date): string;
export function dataSemHora(data: Date | null): string | null;
export function dataSemHora(data: Date | null): string | null {
  return data ? data.toISOString().slice(0, 10) : null;
}

/** Idade em anos completos hoje. */
export function idade(nascimento: Date): number {
  const hoje = new Date();
  const anos = hoje.getUTCFullYear() - nascimento.getUTCFullYear();
  const fezAniversario =
    hoje.getUTCMonth() > nascimento.getUTCMonth() ||
    (hoje.getUTCMonth() === nascimento.getUTCMonth() &&
      hoje.getUTCDate() >= nascimento.getUTCDate());
  return fezAniversario ? anos : anos - 1;
}

/** Busca sem diferenciar maiúsculas/minúsculas: "marcia" encontra "Marcia". */
export const igual = (valor: string) => ({
  equals: valor,
  mode: 'insensitive' as const,
});

/** Busca por trecho, sem diferenciar maiúsculas/minúsculas. */
export const contem = (valor: string) => ({
  contains: valor,
  mode: 'insensitive' as const,
});

/** "Cuiabá / MT", como as telas mostram. */
export const nomeMunicipio = (
  cidade: { nomeCidade: string; estados: { uf: string } } | null,
) => (cidade ? `${cidade.nomeCidade} / ${cidade.estados.uf}` : null);

const PREPOSICOES = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

/** "  MARIA  da silva " → "Maria da Silva" (preposições ficam minúsculas). */
export const nomeProprio = (nome: string) =>
  nome
    .trim()
    .toLocaleLowerCase('pt-BR')
    .split(/\s+/)
    .map((p, i) =>
      i > 0 && PREPOSICOES.has(p)
        ? p
        : p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1),
    )
    .join(' ');
