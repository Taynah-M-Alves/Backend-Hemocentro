import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configurarApp } from './configurar-app.js';

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
  configurarApp(app);
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:8080,http://localhost:8081').split(','),
    exposedHeaders: ['Content-Disposition'], // o front lê o nome do arquivo baixado
  });
  app.enableShutdownHooks(); // para a fila da IA ao desligar
  await app.listen(porta);
  Logger.log(`Servidor rodando em http://localhost:${porta}/api`);
}

await bootstrap();
