import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configurarApp } from '../src/configurar-app.js';
import { PermissaoUsuario } from '../src/generated/prisma/enums.js';
import { FilaLeituraService } from '../src/services/fila-leitura.service.js';
import { PrismaService } from '../src/services/prisma.service.js';
import { SessaoService } from '../src/services/sessao.service.js';
import { UsuarioService } from '../src/services/usuario.service.js';

const TOKEN_GESTOR = 'a'.repeat(64);
const TOKEN_COLABORADOR = 'c'.repeat(64);
const TOKEN_SENHA_PROVISORIA = 'd'.repeat(64);
const CSRF = 'b'.repeat(64);

const cadastro = {
  nome: 'Funcionário de teste',
  email: 'funcionario@example.invalid',
  permissoes: ['REVISAR_FICHAS'],
  senha: 'provisoria-123',
};

describe('Cadastro pelo gestor (e2e)', () => {
  let app: INestApplication<App>;

  const criar = vi.fn();
  const alterar = vi.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(FilaLeituraService)
      .useValue({ processar: () => undefined })
      .overrideProvider(UsuarioService)
      .useValue({ criar, alterar })
      .overrideProvider(SessaoService)
      .useValue({
        buscar: async (token: string | undefined) => {
          if (
            token !== TOKEN_GESTOR &&
            token !== TOKEN_COLABORADOR &&
            token !== TOKEN_SENHA_PROVISORIA
          ) {
            return null;
          }

          // Gestor que ainda não trocou a senha provisória
          const gestor = token !== TOKEN_COLABORADOR;

          return {
            id: gestor ? 'sessao-gestor' : 'sessao-colaborador',
            csrfToken: CSRF,
            expiraEm: new Date(Date.now() + 60_000),
            revogadaEm: null,
            usuario: {
              id: gestor ? 1 : 2,
              nome: 'Usuário de teste',
              email: 'usuario@example.invalid',
              ativo: true,
              perfil: gestor ? 'GESTOR' : 'COLABORADOR',
              permissoes: Object.values(PermissaoUsuario),
              trocarSenhaNoProximoLogin: token === TOKEN_SENHA_PROVISORIA,
            },
          };
        },
      })
      .compile();

    app = moduleRef.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  beforeEach(() => {
    criar.mockReset();
    criar.mockResolvedValue({
      id: 3,
      ...cadastro,
      ativo: true,
      perfil: 'COLABORADOR',
      colaboradorId: null,
      colaborador: null,
    });
  });

  afterAll(async () => {
    await app?.close();
  });

  it('permite que gestor cadastre funcionário (201)', async () => {
    await request(app.getHttpServer())
      .post('/api/usuarios')
      .set('Cookie', `hemocentro_sessao=${TOKEN_GESTOR}`)
      .set('X-CSRF-Token', CSRF)
      .send(cadastro)
      .expect(201)
      .expect(({ body }) => {
        expect(body.perfil).toBe('COLABORADOR');
        expect(body.permissoes).toEqual(['REVISAR_FICHAS']);
      });

    expect(criar).toHaveBeenCalledWith({
      ...cadastro,
      colaboradorId: undefined,
    });
  });

  it('recusa cadastro sem senha (400)', async () => {
    const { senha: _senha, ...semSenha } = cadastro;
    await request(app.getHttpServer())
      .post('/api/usuarios')
      .set('Cookie', `hemocentro_sessao=${TOKEN_GESTOR}`)
      .set('X-CSRF-Token', CSRF)
      .send(semSenha)
      .expect(400);

    expect(criar).not.toHaveBeenCalled();
  });

  it('bloqueia as demais rotas até trocar a senha provisória (403)', () =>
    request(app.getHttpServer())
      .get('/api/usuarios')
      .set('Cookie', `hemocentro_sessao=${TOKEN_SENHA_PROVISORIA}`)
      .expect(403)
      .expect(({ body }) => {
        expect(body.trocarSenhaNoProximoLogin).toBe(true);
      }));

  it('com senha provisória, a sessão avisa que precisa trocar', () =>
    request(app.getHttpServer())
      .get('/api/auth/sessao')
      .set('Cookie', `hemocentro_sessao=${TOKEN_SENHA_PROVISORIA}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.usuario.trocarSenhaNoProximoLogin).toBe(true);
      }));

  it('com senha provisória, chega à validação da troca de senha', () =>
    request(app.getHttpServer())
      .post('/api/auth/trocar-senha')
      .set('Cookie', `hemocentro_sessao=${TOKEN_SENHA_PROVISORIA}`)
      .set('X-CSRF-Token', CSRF)
      .send({ senhaAtual: 'provisoria-123', novaSenha: 'provisoria-123' })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe('A nova senha precisa ser diferente da atual.');
      }));

  it('troca de senha exige CSRF (403)', () =>
    request(app.getHttpServer())
      .post('/api/auth/trocar-senha')
      .set('Cookie', `hemocentro_sessao=${TOKEN_SENHA_PROVISORIA}`)
      .send({ senhaAtual: 'provisoria-123', novaSenha: 'nova-senha-456' })
      .expect(403));

  it('gestor obriga um usuário a trocar a senha pelo PATCH', async () => {
    alterar.mockResolvedValue({ id: 3, trocarSenhaNoProximoLogin: true });
    await request(app.getHttpServer())
      .patch('/api/usuarios/3')
      .set('Cookie', `hemocentro_sessao=${TOKEN_GESTOR}`)
      .set('X-CSRF-Token', CSRF)
      .send({ trocarSenhaNoProximoLogin: true })
      .expect(200);

    expect(alterar).toHaveBeenCalledWith(3, {
      nome: undefined,
      colaboradorId: undefined,
      trocarSenhaNoProximoLogin: true,
    });
  });

  it('recusa trocarSenhaNoProximoLogin que não seja booleano (400)', () =>
    request(app.getHttpServer())
      .patch('/api/usuarios/3')
      .set('Cookie', `hemocentro_sessao=${TOKEN_GESTOR}`)
      .set('X-CSRF-Token', CSRF)
      .send({ trocarSenhaNoProximoLogin: 'sim' })
      .expect(400));

  it('recusa cadastro sem sessão (401)', async () => {
    await request(app.getHttpServer())
      .post('/api/usuarios')
      .send(cadastro)
      .expect(401);

    expect(criar).not.toHaveBeenCalled();
  });

  it('recusa cadastro por colaborador mesmo com todas as permissões (403)', async () => {
    await request(app.getHttpServer())
      .post('/api/usuarios')
      .set('Cookie', `hemocentro_sessao=${TOKEN_COLABORADOR}`)
      .set('X-CSRF-Token', CSRF)
      .send(cadastro)
      .expect(403);

    expect(criar).not.toHaveBeenCalled();
  });

  it('recusa listagem de contas por colaborador (403)', () =>
    request(app.getHttpServer())
      .get('/api/usuarios')
      .set('Cookie', `hemocentro_sessao=${TOKEN_COLABORADOR}`)
      .expect(403));

  it('recusa cadastro pelo gestor sem CSRF (403)', async () => {
    await request(app.getHttpServer())
      .post('/api/usuarios')
      .set('Cookie', `hemocentro_sessao=${TOKEN_GESTOR}`)
      .send(cadastro)
      .expect(403);

    expect(criar).not.toHaveBeenCalled();
  });

  it('recusa tentativa de escolher o perfil GESTOR (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/usuarios')
      .set('Cookie', `hemocentro_sessao=${TOKEN_GESTOR}`)
      .set('X-CSRF-Token', CSRF)
      .send({ ...cadastro, perfil: 'GESTOR' })
      .expect(400);

    expect(criar).not.toHaveBeenCalled();
  });

  it('recusa permissão inexistente (400)', async () => {
    await request(app.getHttpServer())
      .post('/api/usuarios')
      .set('Cookie', `hemocentro_sessao=${TOKEN_GESTOR}`)
      .set('X-CSRF-Token', CSRF)
      .send({
        ...cadastro,
        permissoes: ['ADMINISTRAR_TUDO'],
      })
      .expect(400);

    expect(criar).not.toHaveBeenCalled();
  });

  it('permite chegar à validação do esqueci-senha sem sessão', () =>
    request(app.getHttpServer())
      .post('/api/auth/esqueci-senha')
      .send({})
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toContain('email');
      }));

  it('permite chegar à validação da redefinição sem sessão', () =>
    request(app.getHttpServer())
      .post('/api/auth/redefinir-senha')
      .send({})
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe('Link inválido ou expirado. Peça um novo.');
      }));
});
