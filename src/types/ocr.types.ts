import type { FichaExtraida } from './ficha.types.js';

/** Qual IA leu a ficha. Ordem de tentativa: gemini → groq → openrouter → openai. */
export type ProvedorIa = 'gemini' | 'groq' | 'openrouter' | 'openai';

/** Uma página do documento já convertida em imagem JPEG. */
export interface PaginaImagem {
  numero: number;
  jpeg: Buffer;
}

/** Resultado de cada IA tentada, para mostrar o que falhou e por quê. */
export interface TentativaExtracao {
  provedor: ProvedorIa;
  sucesso: boolean;
  erro: string | null;
  duracaoMs: number;
}

/** Retorno do AiExtractionService: os dados, qual IA respondeu e o que aconteceu com cada uma. */
export interface ExtracaoIA {
  dados: FichaExtraida;
  provedor: ProvedorIa;
  tentativas: TentativaExtracao[];
}
