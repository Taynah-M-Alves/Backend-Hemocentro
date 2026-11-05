import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { PrismaErroFilter } from './filters/prisma-erro.filter.js';
import { isoLocal } from './utils/formatos.js';

/** Configuração comum ao servidor e aos testes e2e. */
export function configurarApp(app: INestApplication): void {
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new PrismaErroFilter());
  const express = app.getHttpAdapter().getInstance();
  // Atrás de proxy (nginx, IIS...), o IP de quem chamou vem no X-Forwarded-For.
  // TRUST_PROXY = número de proxies (ex.: 1) ou IPs deles; sem a variável, usa o IP da conexão.
  const proxy = process.env.TRUST_PROXY;
  if (proxy) express.set('trust proxy', /^\d+$/.test(proxy) ? Number(proxy) : proxy);
  // Toda data e hora das respostas sai no fuso do sistema (isoLocal), não em UTC
  express.set('json replacer', function (this: Record<string, unknown>, chave: string, valor: unknown) {
    const original = this[chave];
    return original instanceof Date ? isoLocal(original) : valor;
  });
}
