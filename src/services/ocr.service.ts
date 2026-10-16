import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { OcrApiResponse } from '../types/ocr.types.js';
import { mensagemDeErro } from '../utils/erros.js';
import { AiExtractionService } from './ai-extraction.service.js';
import { DocumentoImagemService } from './documento-imagem.service.js';
import { FichaPersistenciaService } from './ficha-persistencia.service.js';

/**
 * Coordena o processo inteiro:
 *   arquivo → imagens das páginas → IA (Gemini → Groq → OpenRouter → OpenAI) → banco de dados
 */
@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    private readonly documentoImagem: DocumentoImagemService,
    private readonly aiExtraction: AiExtractionService,
    private readonly persistencia: FichaPersistenciaService,
  ) {}

  async processarFicha(arquivo: Express.Multer.File): Promise<OcrApiResponse> {
    const resposta: OcrApiResponse = {
      sucesso: false,
      arquivo: path.basename(arquivo.path),
      totalPaginas: 0,
      provedorUsado: null,
      tentativas: [],
      dados: null,
      gravacao: null,
      avisos: [],
      erro: null,
    };

    try {
      const paginas = await this.documentoImagem.paraImagens(
        arquivo.path,
        arquivo.mimetype,
      );
      resposta.totalPaginas = paginas.length;

      const { dados, provedor, tentativas } =
        await this.aiExtraction.extrairFicha(paginas);
      resposta.provedorUsado = provedor;
      resposta.tentativas = tentativas;
      resposta.dados = dados;

      const { resumo, avisos } = await this.persistencia.salvar(dados);
      resposta.gravacao = resumo;
      resposta.avisos = avisos;
      resposta.sucesso = true;
      this.logger.log(
        `Ficha gravada (${provedor}): ${JSON.stringify(resposta.gravacao)}`,
      );
    } catch (err: unknown) {
      resposta.erro = mensagemDeErro(err);
      this.logger.error(
        `Erro no processamento: ${resposta.erro}`,
        err instanceof Error ? err.stack : undefined,
      );

      // Nada foi gravado, então o arquivo não é referenciado por ninguém
      await fs.promises.unlink(arquivo.path).catch(() => undefined);
    }

    return resposta;
  }
}
