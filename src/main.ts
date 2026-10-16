import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

/** Carrega o .env (DATABASE_URL, chaves das IAs...). Sem .env, usa as variáveis do sistema. */
function carregarEnv(): void {
  try {
    process.loadEnvFile();
  } catch {
    Logger.warn(
      'Arquivo .env não encontrado; usando só as variáveis de ambiente do sistema.',
    );
  }
}

async function bootstrap(): Promise<void> {
  carregarEnv();
  const porta = process.env.PORT ?? 3000;

  const app = await NestFactory.create(AppModule);
  await app.listen(porta);
  Logger.log(`Servidor rodando em http://localhost:${porta}`);
}

await bootstrap();
