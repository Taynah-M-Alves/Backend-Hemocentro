import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { PrismaErroFilter } from './filters/prisma-erro.filter.js';
import { isoLocal } from './utils/formatos.js';

/** Configuração comum ao servidor e aos testes e2e. */
export function configurarApp(app: INestApplication): void {
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new PrismaErroFilter());
  // Toda data e hora das respostas sai no fuso do sistema (isoLocal), não em UTC
  app
    .getHttpAdapter()
    .getInstance()
    .set('json replacer', function (this: Record<string, unknown>, chave: string, valor: unknown) {
      const original = this[chave];
      return original instanceof Date ? isoLocal(original) : valor;
    });
}
