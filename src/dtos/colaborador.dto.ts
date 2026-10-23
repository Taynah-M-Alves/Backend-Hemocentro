import { corpo, textoObrigatorio } from '../utils/validacao.js';

/** POST /api/colaboradores */
export interface CriarColaboradorDto {
  nome: string;
}

export function lerCriarColaboradorDto(body: unknown): CriarColaboradorDto {
  return { nome: textoObrigatorio(corpo(body), 'nome') };
}
