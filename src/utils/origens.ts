/** Origens do frontend (CORS_ORIGINS, separadas por vírgula). Sem a variável, libera 8080 e 8081. */
export const origensPermitidas = (): string[] =>
  (process.env.CORS_ORIGINS ?? 'http://localhost:8080,http://localhost:8081')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
