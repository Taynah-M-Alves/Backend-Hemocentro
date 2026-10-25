import type { INestApplication } from '@nestjs/common';
import { PrismaErroFilter } from './filters/prisma-erro.filter.js';

/** Configuração comum ao servidor e aos testes e2e. */
export function configurarApp(app: INestApplication): void {
  app.setGlobalPrefix('api'); // separa a API das páginas do frontend
  app.useGlobalFilters(new PrismaErroFilter());
}
