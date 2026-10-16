import { Injectable, Logger } from '@nestjs/common';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import * as fs from 'fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { PaginaImagem } from '../types/ocr.types.js';

/**
 * Maior lado da imagem, em pixels. 2000 px é nítido o bastante para ler letra
 * manuscrita e deixa o envio para a IA leve (as fotos de celular costumam ter 4000+ px).
 */
const LADO_MAXIMO_PX = 2000;
const QUALIDADE_JPEG = 85;

/** Converte o arquivo enviado (PDF ou imagem) em uma lista de imagens JPEG, uma por página. */
@Injectable()
export class DocumentoImagemService {
  private readonly logger = new Logger(DocumentoImagemService.name);

  async paraImagens(
    filePath: string,
    mimeType: string,
  ): Promise<PaginaImagem[]> {
    const buffer = await fs.promises.readFile(filePath);
    return mimeType === 'application/pdf'
      ? this.renderizarPdf(buffer)
      : [{ numero: 1, jpeg: await this.redimensionarImagem(buffer) }];
  }

  /** Desenha cada página do PDF num "canvas" (tela) e salva como JPEG. */
  private async renderizarPdf(buffer: Buffer): Promise<PaginaImagem[]> {
    const carregamento = getDocument({ data: new Uint8Array(buffer) });
    const pdf = await carregamento.promise;
    this.logger.log(`PDF com ${pdf.numPages} página(s).`);

    const paginas: PaginaImagem[] = [];
    for (let numero = 1; numero <= pdf.numPages; numero++) {
      const page = await pdf.getPage(numero);

      // Calcula a escala para o maior lado ficar com LADO_MAXIMO_PX
      const tamanhoOriginal = page.getViewport({ scale: 1 });
      const escala =
        LADO_MAXIMO_PX /
        Math.max(tamanhoOriginal.width, tamanhoOriginal.height);
      const viewport = page.getViewport({ scale: escala });

      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
      await page.render({
        // O pdfjs foi feito para o navegador; os tipos dele esperam um canvas do navegador
        canvas: canvas as unknown as HTMLCanvasElement,
        viewport,
      }).promise;

      paginas.push({
        numero,
        jpeg: canvas.toBuffer('image/jpeg', QUALIDADE_JPEG),
      });
      page.cleanup();
    }

    await carregamento.destroy();
    return paginas;
  }

  /** Diminui fotos muito grandes e converte tudo para JPEG. */
  private async redimensionarImagem(buffer: Buffer): Promise<Buffer> {
    const img = await loadImage(buffer);
    const escala = Math.min(
      1,
      LADO_MAXIMO_PX / Math.max(img.width, img.height),
    );
    const canvas = createCanvas(
      Math.round(img.width * escala),
      Math.round(img.height * escala),
    );
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toBuffer('image/jpeg', QUALIDADE_JPEG);
  }
}
