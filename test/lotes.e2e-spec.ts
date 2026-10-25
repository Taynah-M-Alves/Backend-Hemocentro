import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/configurar-app.js';
import { FilaLeituraService } from '../src/services/fila-leitura.service.js';
import { PrismaService } from '../src/services/prisma.service.js';

describe('POST /api/lotes (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      // Os testes abaixo param na validação do upload; não precisam de banco nem da fila da IA
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(FilaLeituraService)
      .useValue({ processar: () => undefined })
      .compile();

    app = moduleRef.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('recusa requisição sem arquivo (400)', () => {
    return request(app.getHttpServer())
      .post('/api/lotes')
      .set('X-Usuario-Id', '1')
      .expect(400)
      .expect(({ body }) => expect(body.message).toMatch(/Nenhum arquivo recebido/));
  });

  it('recusa tipo de arquivo não suportado (400)', () => {
    return request(app.getHttpServer())
      .post('/api/lotes')
      .set('X-Usuario-Id', '1')
      .attach('arquivos', Buffer.from('texto qualquer'), {
        filename: 'ficha.txt',
        contentType: 'text/plain',
      })
      .expect(400)
      .expect(({ body }) => expect(body.message).toMatch(/Tipo de arquivo não suportado/));
  });

  it('exige o header X-Usuario-Id nas rotas que alteram dados (400)', () => {
    return request(app.getHttpServer())
      .post('/api/fichas/1/iniciar-revisao')
      .expect(400)
      .expect(({ body }) => expect(body.message).toMatch(/X-Usuario-Id/));
  });
});
