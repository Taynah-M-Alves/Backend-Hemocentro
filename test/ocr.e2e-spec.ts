import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/services/prisma.service.js';

describe('POST /ocr/extract (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      // Os testes abaixo param na validação do upload; não precisam de banco
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('recusa requisição sem arquivo (400)', () => {
    return request(app.getHttpServer())
      .post('/ocr/extract')
      .expect(400)
      .expect(({ body }) =>
        expect(body.message).toMatch(/Nenhum arquivo recebido/),
      );
  });

  it('recusa tipo de arquivo não suportado (400)', () => {
    return request(app.getHttpServer())
      .post('/ocr/extract')
      .attach('file', Buffer.from('texto qualquer'), {
        filename: 'ficha.txt',
        contentType: 'text/plain',
      })
      .expect(400)
      .expect(({ body }) =>
        expect(body.message).toMatch(/Tipo de arquivo não suportado/),
      );
  });
});
