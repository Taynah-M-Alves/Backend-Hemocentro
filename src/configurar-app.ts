import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { PrismaErroFilter } from './filters/prisma-erro.filter.js';

/** Configuração comum ao servidor e aos testes e2e. */
export function configurarApp(app: INestApplication): void {
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new PrismaErroFilter());
}
