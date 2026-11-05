import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/configurar-app.js';
import { FilaLeituraService } from '../src/services/fila-leitura.service.js';
import { PrismaService } from '../src/services/prisma.service.js';
import { SessaoService } from '../src/services/sessao.service.js';

const TOKEN_TESTE = 'a'.repeat(64);
const CSRF_TESTE = 'b'.repeat(64);
const COOKIE_TESTE = `hemocentro_sessao=${TOKEN_TESTE}`;

describe('Proteção das APIs e validação do upload (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(FilaLeituraService)
      .useValue({ processar: () => undefined })
      .overrideProvider(SessaoService)
      .useValue({
        buscar: async (token: string | undefined) =>
          token === TOKEN_TESTE
            ? {
                id: 'sessao-de-teste',
                csrfToken: CSRF_TESTE,
                expiraEm: new Date(Date.now() + 60_000),
                revogadaEm: null,
                usuario: {
                  id: 1,
                  nome: 'Gestor de teste',
                  email: 'gestor@example.invalid',
                  ativo: true,
                  perfil: 'GESTOR',
                  permissoes: [],
                },
              }
            : null,
      })
      .compile();

    app = moduleRef.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('recusa consulta sem sessão (401)', () =>
    request(app.getHttpServer()).get('/api/usuarios').expect(401));

  it('não aceita X-Usuario-Id como autenticação (401)', () =>
    request(app.getHttpServer())
      .post('/api/fichas/1/iniciar-revisao')
      .set('X-Usuario-Id', '1')
      .expect(401));

  it('recusa cookie sem sessão reconhecida (401)', () =>
    request(app.getHttpServer())
      .get('/api/auth/sessao')
      .set('Cookie', `hemocentro_sessao=${'c'.repeat(64)}`)
      .expect(401));

  it('recusa alteração sem CSRF (403)', () =>
    request(app.getHttpServer())
      .post('/api/lotes')
      .set('Cookie', COOKIE_TESTE)
      .expect(403));

  it('recusa alteração com CSRF incorreto (403)', () =>
    request(app.getHttpServer())
      .post('/api/lotes')
      .set('Cookie', COOKIE_TESTE)
      .set('X-CSRF-Token', 'c'.repeat(64))
      .expect(403));

  it('recusa origem não permitida mesmo com sessão e CSRF (403)', () =>
    request(app.getHttpServer())
      .post('/api/lotes')
      .set('Cookie', COOKIE_TESTE)
      .set('X-CSRF-Token', CSRF_TESTE)
      .set('Origin', 'https://origem-nao-permitida.example')
      .expect(403));

  it('valida arquivo ausente após autenticação (400)', () =>
    request(app.getHttpServer())
      .post('/api/lotes')
      .set('Cookie', COOKIE_TESTE)
      .set('X-CSRF-Token', CSRF_TESTE)
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toMatch(/Nenhum arquivo recebido/);
      }));

  it('recusa tipo de arquivo não suportado após autenticação (400)', () =>
    request(app.getHttpServer())
      .post('/api/lotes')
      .set('Cookie', COOKIE_TESTE)
      .set('X-CSRF-Token', CSRF_TESTE)
      .attach('arquivos', Buffer.from('texto qualquer'), {
        filename: 'ficha.txt',
        contentType: 'text/plain',
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toMatch(/Tipo de arquivo não suportado/);
      }));
});
