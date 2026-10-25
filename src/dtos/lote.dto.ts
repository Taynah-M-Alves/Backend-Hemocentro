import { corpo, textoOpcional } from '../utils/validacao.js';

/** POST /api/lotes — campos de texto do multipart (os arquivos vêm no campo "arquivos"). */
export interface CriarLoteDto {
  /** Opcional. Padrão: "dd-mm-aaaa"; cada arquivo vira "{lote}.{seq} - {nome}" */
  nome?: string;
}

export const lerCriarLoteDto = (body: unknown): CriarLoteDto => ({
  nome: textoOpcional(corpo(body ?? {}), 'nome', 120),
});
