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
const TIMEOUT_MS = 900_000;
/**
 * Inclui o "raciocínio" do modelo, que gasta boa parte do limite. Com 8000 o Gemini cortava o
 * JSON no meio depois que o prompt passou a pedir kits e fenotipagem.
 */
const MAX_TOKENS = 32_000; // máximo do gpt-4.1
const TEMPERATURA = 0.1;
/** Fichas maiores que isso são lidas em partes e juntadas no fim. A Groq só aceita 3 imagens. */
const PAGINAS_POR_PARTE = 12;
const PAGINAS_POR_PARTE_GROQ = 3;

/** Modelos de cada IA (o .env só tem as chaves). Todos precisam ler imagens. */
const MODELOS = {
  // O seguinte só é usado quando o anterior está sobrecarregado (503)
  gemini: [
    'gemini-3.8-flash',
    'gemini-3.6-flash',
    'gemini-3-flash-preview',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
  ],
  // Único modelo da Groq que lê imagens (o llama-4-scout foi desligado em 17/07/2026)
  groq: 'qwen/qwen3.8-27b',
  openrouter: 'google/gemini-3.8-flash',
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
    // maxRetries: 0 → cada IA é chamada uma vez só; quem lê de novo é o usuário (reprocessar)
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

    this.provedores = [
      {
        id: 'gemini',
        nome: 'Gemini',
        extrair:
          gemini && ((p) => this.chamarGemini(gemini, MODELOS.gemini, p)),
      },
      {
        id: 'groq',
        nome: 'Groq',
        extrair: groq && ((p) => this.chamarGroq(groq, MODELOS.groq, p)),
      },
      {
        id: 'openrouter',
        nome: 'OpenRouter',
        extrair:
          openRouter &&
          ((p) =>
            this.chamarOpenAiCompativel(openRouter, MODELOS.openrouter, p)),
      },
      {
        id: 'openai',
        nome: 'OpenAI',
        extrair:
          openAi &&
          ((p) => this.chamarOpenAiCompativel(openAi, MODELOS.openai, p)),
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
   * Cada IA é chamada uma vez; a primeira que devolver uma ficha válida vence.
   * Se todas falharem, lança erro com o motivo de cada uma.
   */
  async extrairFicha(paginas: PaginaImagem[]): Promise<ExtracaoIA> {
    const tentativas: TentativaExtracao[] = [];

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
        const dados = await this.lerEmPartes(
          extrair,
          paginas,
          id === 'groq' ? PAGINAS_POR_PARTE_GROQ : PAGINAS_POR_PARTE,
        );
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
    throw new Error(`Todas as IAs falharam. Detalhes: [${detalhes}]`);
  }

  /** Lê as páginas em grupos de `tamanho` e junta tudo numa ficha só. */
  private async lerEmPartes(
    extrair: Extrair,
    paginas: PaginaImagem[],
    tamanho: number,
  ): Promise<FichaExtraida> {
    const partes: FichaExtraida[] = [];
    for (let i = 0; i < paginas.length; i += tamanho) {
      if (paginas.length > tamanho)
        this.logger.log(
          `Parte: páginas ${i + 1} a ${Math.min(i + tamanho, paginas.length)}…`,
        );
      const parte = await extrair(paginas.slice(i, i + tamanho));
      // A IA numera as páginas de cada parte a partir de 1
      for (const item of [
        ...parte.transfusoes,
        ...parte.pesquisas,
        ...parte.kits,
      ])
        if (item.pagina) item.pagina += i;
      partes.push(parte);
    }

    const [ficha, ...resto] = partes;
    for (const p of resto) {
      ficha.dataAtendimento ??= p.dataAtendimento;
      ficha.motivo ??= p.motivo;
      // Cabeçalho do paciente: fica o primeiro valor lido em qualquer parte
      for (const [campo, valor] of Object.entries(p.paciente))
        (ficha.paciente as unknown as Record<string, unknown>)[campo] ??= valor;
      ficha.transfusoes.push(...p.transfusoes);
      ficha.pesquisas.push(...p.pesquisas);
      ficha.kits.push(...p.kits);
    }
    exigirIdentificacao(ficha);
    return ficha;
  }

  // ── Provedores ────────────────────────────────────────────────────────────

  /** Tenta os modelos em ordem; só passa ao seguinte quando o atual responde 503 (sobrecarga). */
  private async chamarGemini(
    cliente: GoogleGenerativeAI,
    modelos: string[],
    paginas: PaginaImagem[],
  ): Promise<FichaExtraida> {
    const conteudo = [
      { text: PROMPT_EXTRACAO_FICHA },
      ...paginas.map((p) => ({
        inlineData: { mimeType: 'image/jpeg', data: p.jpeg.toString('base64') },
      })),
    ];
    const erros: string[] = []; // um por modelo tentado, para o erro final mostrar todos

    for (const [i, modelo] of modelos.entries()) {
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
      try {
        const result = await model.generateContent(conteudo);
        return this.parseJson(result.response.text());
      } catch (err) {
        erros.push(`${modelo}: ${mensagemDeErro(err)}`);
        const proximo = modelos[i + 1];
        if (!proximo || (err as { status?: number }).status !== 503)
          throw new Error(erros.join(' ; '));
        this.logger.warn(
          `Gemini ${modelo} sobrecarregado (503) — tentando ${proximo}…`,
        );
      }
    }
    throw new Error('Nenhum modelo do Gemini.');
  }

  /** O qwen3.8 aceita no máximo 3 imagens por pedido (por isso lerEmPartes manda de 3 em 3). */
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
      max_completion_tokens: 16384, // máximo do qwen3.8 na Groq
      reasoning_format: 'hidden', // só o JSON, sem o raciocínio
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

  /** Remove um eventual bloco ```json``` e confere os campos (nome + nascimento: em lerEmPartes). */
  private parseJson(raw: string): FichaExtraida {
    const limpo = raw
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    if (!limpo) throw new Error('A IA respondeu vazio.');
    return sanitizarFicha(JSON.parse(limpo));
  }
}
