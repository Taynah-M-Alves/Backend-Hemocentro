# Backend do Hemocentro. Usado pelo docker-compose.yml (veja DEPLOY.md).
# Debian (glibc): argon2 e @napi-rs/canvas baixam binários prontos para ele.
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && mkdir -p uploads && chown node:node uploads

USER node
EXPOSE 3000
# Aplica as migrações pendentes e sobe a API
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main.js"]
