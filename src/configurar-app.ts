import type { INestApplication } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { PrismaErroFilter } from './filters/prisma-erro.filter.js';
import { isoLocal } from './utils/formatos.js';
import { origensPermitidas } from './utils/origens.js';

/** Configuração comum ao servidor e aos testes e2e. */
export function configurarApp(app: INestApplication): void {
  app.use(cookieParser());
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new PrismaErroFilter());
  const express = app.getHttpAdapter().getInstance();
  express.disable('x-powered-by');
  // Parâmetro repetido (?busca=a&busca=b) vale o último, sempre como texto: nunca vira lista
  express.set('query parser', (texto: string) => Object.fromEntries(new URLSearchParams(texto)));
  // Dados de pacientes: nada em cache e nada interpretado como página. O frontend mostra o
  // arquivo da ficha num <iframe>, por isso frame-ancestors lista as origens dele e o arquivo
  // fica sem default-src (o leitor de PDF do navegador precisa carregar os recursos dele).
  const molduras = `frame-ancestors ${origensPermitidas().join(' ') || "'none'"}`;
  app.use((req: { path: string }, res: { set(h: Record<string, string>): void }, next: () => void) => {
    const arquivo = /\/documentos\/\d+\/arquivo$/.test(req.path);
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': arquivo ? molduras : `default-src 'none'; ${molduras}`,
    });
    next();
  });
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
