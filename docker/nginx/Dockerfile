# Frontend (build do Vue) servido pelo nginx, que também repassa /api ao backend.
# O código do front vem do contexto "front" (../projeto_hemocentro, no docker-compose.yml).
FROM node:24-alpine AS build
WORKDIR /front
COPY --from=front package.json package-lock.json ./
RUN npm ci
# Só o necessário: sem node_modules nem .env da máquina de origem
COPY --from=front public ./public
COPY --from=front src ./src
COPY --from=front .browserslistrc .eslintrc.js babel.config.js tsconfig.json vue.config.js ./
ARG VUE_APP_API_URL=/api
ENV VUE_APP_API_URL=$VUE_APP_API_URL
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /front/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
