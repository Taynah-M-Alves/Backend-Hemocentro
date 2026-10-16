## 🚀 Como Executar o Projeto

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão LTS recomendada)
- Instância do PostgreSQL rodando (localmente ou via Docker)

### 1. Clonar o repositório e entrar na pasta
```bash
git clone https://github.com/Taynah-M-Alves/Backend-Hemocentro.git
```
```bash
cd Backend-Hemocentro
```

## Project setup

```bash
$ npm install
```

```bash
$ npx prisma generate
```

```bash
$ npx prisma db push
```

**é necessario ter adicionado o database_url na env para o comando `npx prisma db push` funcionar**

### Leitura das fichas digitalizadas (OCR)

`POST /ocr/extract` recebe a ficha (PDF, JPEG ou PNG, campo `file`), lê os dados e grava
paciente, transfusões e pesquisas de anticorpos no banco.

As páginas são convertidas em imagem e enviadas para uma IA com visão, que lê os campos
manuscritos. A leitura tenta, nesta ordem: **Gemini → Groq → OpenRouter → OpenAI**. Se uma falhar,
o erro aparece em `tentativas` na resposta e a próxima é usada. Configure pelo menos uma chave no
`.env` (veja `.env.example`):

```
GEMINI_API_KEY=...
GROQ_API_KEY=...
OPENROUTER_API_KEY=...   # chave da OpenRouter (sk-or-v1-...)
OPENAI_API_KEY=...       # chave da OpenAI (sk-...)
```

### Estrutura

```
src/
├── config/upload.config.ts      # multer: pasta, nome do arquivo, tamanho e tipos aceitos
├── controllers/ocr.controller.ts # POST /ocr/extract
├── prompts/                     # instruções enviadas para a IA
├── services/
│   ├── ocr.service.ts               # coordena: arquivo → imagens → IA → banco
│   ├── documento-imagem.service.ts  # PDF/foto → uma imagem JPEG por página
│   ├── ai-extraction.service.ts     # Gemini → Groq → OpenRouter → OpenAI
│   ├── ficha-persistencia.service.ts # grava paciente, transfusões e pesquisas (transação)
│   └── prisma.service.ts            # conexão com o banco
├── types/                       # ficha.types.ts (dados da ficha) e ocr.types.ts (fluxo e resposta)
└── utils/                       # ficha-sanitize.ts (confere a resposta da IA) e erros.ts
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Observability

In production applications, observability is essential for understanding how your system behaves, detecting issues early, and maintaining reliable performance.

[NestJS Observe](https://observe.nestjs.com) automatically instruments your NestJS application, giving you deep visibility into your system with minimal setup:

- **Distributed tracing:** Follow requests across services and understand how they flow through your system.
- **Waterfall analysis:** Visualize request execution and identify slow operations, bottlenecks, and unexpected delays.
- **Performance analysis:** Analyze application performance in real time and quickly pinpoint areas that need optimization.
- **Metrics:** Track key application and infrastructure metrics to understand system health and performance trends.
- **Logging:** Centralize and correlate logs with traces and other telemetry to make debugging easier.
- **Error tracking:** Detect errors quickly and investigate their root causes with the surrounding context.
- **SLA monitoring:** Track service-level objectives and identify when your application is approaching or exceeding defined thresholds.
- **Alarms and alerts:** Set up alerts for critical errors, performance degradation, SLA violations, and other anomalies so your team can react quickly.

To add it to this project:

```bash
$ npm install @nestjs/observe
```

Then follow the [setup guide](https://docs.nestjs.com/observability/overview) - it takes a single import and an app key.

The free plan needs no payment details and covers 300,000 events a month. You can also browse the [live demo](https://www.observe-demo.nestjs.com/dashboard) first - the whole dashboard over a busy service's data, with nothing to install.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Auto-instrument your application with [NestJS Observe](https://observe.nestjs.com). Distributed tracing, metrics, and logging made easy. Error tracking and performance monitoring for your NestJS applications.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
