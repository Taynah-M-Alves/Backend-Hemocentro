import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import OpenAI from 'openai';
import { PROMPT_EXTRACAO_FICHA } from '../prompts/ficha-extracao.prompt.js';
import type { FichaExtraida } from '../types/ficha.types.js';
import type {
  ExtracaoIA,
  PaginaImagem,
  ProvedorIa,
  TentativaExtracao,
} from '../types/ocr.types.js';
import { mensagemDeErro } from '../utils/erros.js';
import {
  exigirIdentificacao,
  sanitizarFicha,
} from '../utils/ficha-sanitize.js';

/** Tempo máximo esperando uma IA antes de desistir e tentar a próxima. */
const TIMEOUT_MS = 500_000;
/**
 * Inclui o "raciocínio" do modelo, que gasta boa parte do limite. Com 8000 o Gemini cortava o
 * JSON no meio depois que o prompt passou a pedir kits e fenotipagem.
 */
const MAX_TOKENS = 20000;
const TEMPERATURA = 0.1;
const MAX_RETRIES = 2;
const ESPERA_INICIAL_MS = 1200;
const STATUS_TRANSITORIOS = [429, 500, 502, 503, 504];
/** Erros de rede e tempo esgotado também passam se tentar de novo mais tarde. */
const MENSAGENS_TRANSITORIAS =
  /high demand|timed? ?out|timeout|aborted|fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|socket hang up/i;

/** Erro de "todas as IAs falharam". `transitoria` = alguma falhou por algo passageiro. */
export class FalhaLeituraError extends Error {
  constructor(
    message: string,
    readonly transitoria: boolean,
  ) {
    super(message);
  }
}

/** Modelo usado quando o *_MODEL correspondente não está no .env. Todos precisam ler imagens. */
const MODELO_PADRAO: Record<ProvedorIa, string> = {
  gemini: 'gemini-3.7-flash',
  groq: 'meta-llama/llama-4-scout-17b-16e-instruct',
  openrouter: 'google/gemini-3.7-flash',
  openai: 'gpt-4.1',
};

type Extrair = (paginas: PaginaImagem[]) => Promise<FichaExtraida>;

interface Provedor {
  id: ProvedorIa;
  nome: string;
  /** `null` quando a chave não está no .env (a IA é pulada). */
  extrair: Extrair | null;
}

@Injectable()
export class AiExtractionService {
  private readonly logger = new Logger(AiExtractionService.name);

  /** Ordem de tentativa: Gemini → Groq → OpenRouter → OpenAI. */
  private readonly provedores: Provedor[];

  constructor() {
    // maxRetries: 0 → quem decide quando tentar de novo é o chamarComRetry, igual para todas
    const env = process.env;
    const gemini = env.GEMINI_API_KEY
      ? new GoogleGenerativeAI(env.GEMINI_API_KEY)
      : null;
    const groq = env.GROQ_API_KEY
      ? new Groq({
          apiKey: env.GROQ_API_KEY,
          maxRetries: 0,
          timeout: TIMEOUT_MS,
        })
      : null;
    const openRouter = env.OPENROUTER_API_KEY
      ? new OpenAI({
          baseURL: 'https://openrouter.ai/api/v1',
          apiKey: env.OPENROUTER_API_KEY,
          maxRetries: 0,
          timeout: TIMEOUT_MS,
          defaultHeaders: { 'X-Title': 'Hemocentro OCR' },
        })
      : null;
    const openAi = env.OPENAI_API_KEY
      ? new OpenAI({
          apiKey: env.OPENAI_API_KEY,
          maxRetries: 0,
          timeout: TIMEOUT_MS,
        })
      : null;

    const modelo = (id: ProvedorIa) =>
      env[`${id.toUpperCase()}_MODEL`] || MODELO_PADRAO[id];

    this.provedores = [
      {
        id: 'gemini',
        nome: 'Gemini',
        extrair:
          gemini && ((p) => this.chamarGemini(gemini, modelo('gemini'), p)),
      },
      {
        id: 'groq',
        nome: 'Groq',
        extrair: groq && ((p) => this.chamarGroq(groq, modelo('groq'), p)),
      },
      {
        id: 'openrouter',
        nome: 'OpenRouter',
        extrair:
          openRouter &&
          ((p) =>
            this.chamarOpenAiCompativel(openRouter, modelo('openrouter'), p)),
      },
      {
        id: 'openai',
        nome: 'OpenAI',
        extrair:
          openAi &&
          ((p) => this.chamarOpenAiCompativel(openAi, modelo('openai'), p)),
      },
    ];

    for (const { id, nome, extrair } of this.provedores) {
      if (!extrair)
        this.logger.warn(
          `${id.toUpperCase()}_API_KEY não definida — ${nome} desativado.`,
        );
    }
  }

  /**
   * Envia as imagens das páginas para as IAs, na ordem de `provedores`.
   * A primeira que devolver uma ficha válida vence. Se todas falharem, lança
   * FalhaLeituraError com o motivo de cada uma.
   */
  async extrairFicha(paginas: PaginaImagem[]): Promise<ExtracaoIA> {
    const tentativas: TentativaExtracao[] = [];
    let algumaTransitoria = false;

    for (const { id, nome, extrair } of this.provedores) {
      if (!extrair) {
        tentativas.push({
          provedor: id,
          sucesso: false,
          erro: `${nome} não configurado (chave ausente)`,
          duracaoMs: 0,
        });
        continue;
      }

      const inicio = Date.now();
      try {
        this.logger.log(`Enviando ${paginas.length} página(s) ao ${nome}…`);
        const dados = await this.chamarComRetry(() => extrair(paginas));
        tentativas.push({
          provedor: id,
          sucesso: true,
          erro: null,
          duracaoMs: Date.now() - inicio,
        });
        this.logger.log(
          `${nome} concluiu com sucesso! ${dados.transfusoes.length} transfusão(ões), ${dados.pesquisas.length} pesquisa(s).`,
        );
        return { dados, provedor: id, tentativas };
      } catch (err) {
        const erro = mensagemDeErro(err);
        if (this.isErroTransitorio(err)) algumaTransitoria = true;
        tentativas.push({
          provedor: id,
          sucesso: false,
          erro,
          duracaoMs: Date.now() - inicio,
        });
        this.logger.error(`${nome} falhou: ${erro} — tentando o próximo…`);
      }
    }

    const detalhes = tentativas
      .map((t) => `${t.provedor}: ${t.erro}`)
      .join(' | ');
    throw new FalhaLeituraError(
      `Todas as IAs falharam. Detalhes: [${detalhes}]`,
      algumaTransitoria,
    );
  }

  /** Repete a chamada em erros temporários (sobrecarga, limite de uso), esperando cada vez mais. */
  private async chamarComRetry<T>(fn: () => Promise<T>): Promise<T> {
    let espera = ESPERA_INICIAL_MS;
    for (let tentativa = 1; ; tentativa++) {
      try {
        return await fn();
      } catch (err) {
        if (tentativa > MAX_RETRIES || !this.isErroTransitorio(err)) throw err;
        this.logger.warn(
          `Erro transitório. Tentativa ${tentativa}/${MAX_RETRIES}, aguardando ${espera}ms…`,
        );
        await new Promise((resolve) => setTimeout(resolve, espera));
        espera *= 2;
      }
    }
  }

  private isErroTransitorio(err: unknown): boolean {
    const status = (err as { status?: number }).status;
    if (status !== undefined) return STATUS_TRANSITORIOS.includes(status);
    const msg = mensagemDeErro(err);
    return (
      STATUS_TRANSITORIOS.some((s) => msg.includes(String(s))) ||
      MENSAGENS_TRANSITORIAS.test(msg)
    );
  }

  // ── Provedores ────────────────────────────────────────────────────────────

  private async chamarGemini(
    cliente: GoogleGenerativeAI,
    modelo: string,
    paginas: PaginaImagem[],
  ) {
    const model = cliente.getGenerativeModel(
      {
        model: modelo,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: TEMPERATURA,
          maxOutputTokens: MAX_TOKENS,
        },
      },
      { timeout: TIMEOUT_MS },
    );

    const result = await model.generateContent([
      { text: PROMPT_EXTRACAO_FICHA },
      ...paginas.map((p) => ({
        inlineData: { mimeType: 'image/jpeg', data: p.jpeg.toString('base64') },
      })),
    ]);
    return this.parseJson(result.response.text());
  }

  /** Groq aceita no máximo 5 imagens por pedido; fichas maiores caem para a próxima IA. */
  private async chamarGroq(
    cliente: Groq,
    modelo: string,
    paginas: PaginaImagem[],
  ) {
    const completion = await cliente.chat.completions.create({
      model: modelo,
      // Mesmo formato da OpenAI; só o nome do tipo no SDK do Groq é diferente
      messages: [
        {
          role: 'user',
          content: this.mensagemComImagens(
            paginas,
          ) as Groq.Chat.ChatCompletionContentPart[],
        },
      ],
      temperature: TEMPERATURA,
      max_completion_tokens: MAX_TOKENS,
      response_format: { type: 'json_object' },
    });
    return this.parseJson(completion.choices[0]?.message?.content ?? '');
  }

  /** OpenRouter e OpenAI usam a mesma API (e o mesmo SDK); só muda o endereço e a chave. */
  private async chamarOpenAiCompativel(
    cliente: OpenAI,
    modelo: string,
    paginas: PaginaImagem[],
  ) {
    const completion = await cliente.chat.completions.create({
      model: modelo,
      messages: [{ role: 'user', content: this.mensagemComImagens(paginas) }],
      temperature: TEMPERATURA,
      // Sem esse limite a OpenRouter reserva o máximo do modelo e pode recusar por saldo (HTTP 402)
      max_tokens: MAX_TOKENS,
      response_format: { type: 'json_object' },
    });
    return this.parseJson(completion.choices[0]?.message?.content ?? '');
  }

  /** Mensagem no formato "chat completions": o prompt + uma imagem por página. */
  private mensagemComImagens(
    paginas: PaginaImagem[],
  ): OpenAI.Chat.ChatCompletionContentPart[] {
    return [
      { type: 'text', text: PROMPT_EXTRACAO_FICHA },
      ...paginas.map((p): OpenAI.Chat.ChatCompletionContentPart => ({
        type: 'image_url',
        image_url: {
          url: `data:image/jpeg;base64,${p.jpeg.toString('base64')}`,
          detail: 'high',
        },
      })),
    ];
  }

  // ── Resposta ──────────────────────────────────────────────────────────────

  /** Remove um eventual bloco ```json```, confere os campos e exige nome + nascimento. */
  private parseJson(raw: string): FichaExtraida {
    const limpo = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    if (!limpo) throw new Error('A IA respondeu vazio.');
    const ficha = sanitizarFicha(JSON.parse(limpo));
    exigirIdentificacao(ficha);
    return ficha;
  }
}
