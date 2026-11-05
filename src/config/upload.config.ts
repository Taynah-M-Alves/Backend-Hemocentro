import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface.js';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import * as path from 'path';

/** Pasta onde as fichas enviadas ficam guardadas (o documento original digitalizado). */
export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

/** As fichas reais têm cerca de 3,4 MB por página; 50 MB cabe uma ficha de até ~14 páginas. */
const TAMANHO_MAXIMO_BYTES = 50 * 1024 * 1024; // 50 MB
/** Mais arquivos por envio faria uma única requisição passar de 1 GB. */
export const MAXIMO_ARQUIVOS_POR_ENVIO = 30;
/** O que pesa no custo e no tempo da IA é o número de páginas. */
export const MAXIMO_PAGINAS_POR_ARQUIVO = 20;

/** Tipos aceitos e a extensão gravada em disco (derivada do tipo, nunca do nome enviado). */
const EXTENSAO_POR_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

/** Nome único e imprevisível (ex.: 1760490000000-3f2a9c1e-....pdf). */
function nomeUnico(mimeType: string): string {
  return `${Date.now()}-${randomUUID()}${EXTENSAO_POR_MIME[mimeType]}`;
}

/** Configuração do multer: onde salvar, com que nome, tamanho máximo e tipos aceitos. */
export const uploadLoteOptions: MulterOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      fs.mkdirSync(UPLOADS_DIR, { recursive: true });
      cb(null, UPLOADS_DIR);
    },
    filename: (_req, file, cb) => cb(null, nomeUnico(file.mimetype)),
  }),
  limits: { fileSize: TAMANHO_MAXIMO_BYTES, files: MAXIMO_ARQUIVOS_POR_ENVIO },
  fileFilter: (_req, file, cb) => {
    if (Object.hasOwn(EXTENSAO_POR_MIME, file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(
      new BadRequestException(
        `Tipo de arquivo não suportado: "${file.mimetype}". Envie um arquivo PDF, JPEG ou PNG.`,
      ),
      false,
    );
  },
};
