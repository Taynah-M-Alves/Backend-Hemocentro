import { nomeProprio } from '../utils/formatos.js';
import { corpo, textoObrigatorio } from '../utils/validacao.js';

/** POST /api/colaboradores — nome já normalizado ("Maria da Silva"). */
export interface CriarColaboradorDto {
  nome: string;
}

export function lerCriarColaboradorDto(body: unknown): CriarColaboradorDto {
  return { nome: nomeProprio(textoObrigatorio(corpo(body), 'nome')) };
}
