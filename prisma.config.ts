import { defineConfig } from 'prisma/config';

// Carrega o .env para o Prisma CLI (db push, studio...). Sem .env, usa as variáveis do sistema.
try {
  process.loadEnvFile();
} catch {
  // .env é opcional
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
