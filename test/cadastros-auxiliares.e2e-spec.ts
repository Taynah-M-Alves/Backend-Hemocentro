import type { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { configurarApp } from '../src/configurar-app.js';
import { ColaboradoresController } from '../src/controllers/colaboradores.controller.js';
import { InstituicoesController } from '../src/controllers/instituicoes.controller.js';
import { AutenticacaoGuard } from '../src/guards/autenticacao.guard.js';
import { SomenteGestorGuard } from '../src/guards/somente-gestor.guard.js';
import { ColaboradorService } from '../src/services/colaborador.service.js';
import { InstituicaoService } from '../src/services/instituicao.service.js';
import { SessaoService } from '../src/services/sessao.service.js';

// Valores ficticios: nenhum login real ou acesso ao PostgreSQL.
const GESTOR = 'a'.repeat(64);
const COLABORADOR = 'c'.repeat(64);
const PROVISORIA = 'd'.repeat(64);
const CSRF = 'b'.repeat(64);
const cookie = (token: string) => `hemocentro_sessao=${token}`;

function servicoSimulado() {
  return {
    listar: vi.fn().mockResolvedValue([]),
    buscar: vi.fn().mockResolvedValue([]),
    listarGerenciamento: vi.fn().mockResolvedValue([]),
    criar: vi
      .fn()
      .mockResolvedValue({ id: 7, nome: 'Cadastro Teste', ativo: true }),
    alterar: vi
      .fn()
      .mockResolvedValue({ id: 7, nome: 'Cadastro Teste', ativo: true }),
    definirAtivo: vi.fn().mockResolvedValue({ id: 7 }),
  };
}

describe('Permissoes HTTP dos cadastros auxiliares', () => {
  let app: INestApplication<App>;
  const instituicoes = servicoSimulado();
  const colaboradores = servicoSimulado();

  beforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [InstituicoesController, ColaboradoresController],
      providers: [
        { provide: APP_GUARD, useClass: AutenticacaoGuard },
        SomenteGestorGuard,
        { provide: InstituicaoService, useValue: instituicoes },
        { provide: ColaboradorService, useValue: colaboradores },
        {
          provide: SessaoService,
          useValue: {
            buscar: async (token?: string) => {
              if (![GESTOR, COLABORADOR, PROVISORIA].includes(token ?? ''))
                return null;
              return {
                csrfToken: CSRF,
                usuario: {
                  id: token === COLABORADOR ? 2 : 1,
                  perfil: token === COLABORADOR ? 'COLABORADOR' : 'GESTOR',
                  trocarSenhaNoProximoLogin: token === PROVISORIA,
                },
              };
            },
          },
        },
      ],
    }).compile();
    app = modulo.createNestApplication();
    configurarApp(app);
    await app.init();
  });

  beforeEach(() => vi.clearAllMocks());
  afterAll(async () => {
    await app?.close();
  });

  for (const recurso of ['instituicoes', 'colaboradores'] as const) {
    const servico = recurso === 'instituicoes' ? instituicoes : colaboradores;
    const base = `/api/${recurso}`;
    const rotas = [
      {
        metodo: 'get',
        caminho: `${base}/gerenciamento`,
        status: 200,
        operacao: 'listarGerenciamento',
        argumentos: [],
      },
      {
        metodo: 'post',
        caminho: base,
        status: 201,
        operacao: 'criar',
        argumentos: [{ nome: 'Cadastro Teste' }],
      },
      {
        metodo: 'patch',
        caminho: `${base}/7`,
        status: 200,
        operacao: 'alterar',
        argumentos: [7, { nome: 'Cadastro Teste' }],
      },
      {
        metodo: 'post',
        caminho: `${base}/7/inativar`,
        status: 200,
        operacao: 'definirAtivo',
        argumentos: [7, false],
      },
      {
        metodo: 'post',
        caminho: `${base}/7/reativar`,
        status: 200,
        operacao: 'definirAtivo',
        argumentos: [7, true],
      },
    ] as const;

    describe(recurso, () => {
      it.each([GESTOR, COLABORADOR])(
        'permite consultar opcoes com sessao %s',
        async (token) => {
          await request(app.getHttpServer())
            .get(base)
            .set('Cookie', cookie(token))
            .expect(200);
          if (recurso === 'colaboradores') {
            expect(servico.buscar).toHaveBeenCalledWith(undefined, true);
          } else {
            expect(servico.listar).toHaveBeenCalledWith();
          }
        },
      );

      it('exige sessao para consultar opcoes', async () => {
        await request(app.getHttpServer()).get(base).expect(401);
        expect(servico.listar).not.toHaveBeenCalled();
        expect(servico.buscar).not.toHaveBeenCalled();
      });

      for (const rota of rotas) {
        const descricao = `${rota.metodo.toUpperCase()} ${rota.caminho}`;
        const chamada = () =>
          request(app.getHttpServer())[rota.metodo](rota.caminho);

        it(`exige sessao em ${descricao}`, async () => {
          await chamada().send({ nome: 'Cadastro Teste' }).expect(401);
          expect(servico[rota.operacao]).not.toHaveBeenCalled();
        });

        it(`bloqueia colaborador com CSRF valido em ${descricao}`, async () => {
          await chamada()
            .set('Cookie', cookie(COLABORADOR))
            .set('X-CSRF-Token', CSRF)
            .send({ nome: 'Cadastro Teste' })
            .expect(403);
          expect(servico[rota.operacao]).not.toHaveBeenCalled();
        });

        it(`permite gestor em ${descricao}`, async () => {
          await chamada()
            .set('Cookie', cookie(GESTOR))
            .set('X-CSRF-Token', CSRF)
            .send({ nome: 'Cadastro Teste' })
            .expect(rota.status);
          expect(servico[rota.operacao]).toHaveBeenCalledExactlyOnceWith(
            ...rota.argumentos,
          );
        });

        it(`exige troca da senha provisoria em ${descricao}`, async () => {
          await chamada()
            .set('Cookie', cookie(PROVISORIA))
            .set('X-CSRF-Token', CSRF)
            .send({ nome: 'Cadastro Teste' })
            .expect(403);
          expect(servico[rota.operacao]).not.toHaveBeenCalled();
        });

        if (rota.metodo !== 'get') {
          it(`recusa gestor sem CSRF em ${descricao}`, async () => {
            await chamada()
              .set('Cookie', cookie(GESTOR))
              .send({ nome: 'Cadastro Teste' })
              .expect(403);
            expect(servico[rota.operacao]).not.toHaveBeenCalled();
          });

          it(`recusa CSRF de outra sessao em ${descricao}`, async () => {
            await chamada()
              .set('Cookie', cookie(GESTOR))
              .set('X-CSRF-Token', 'e'.repeat(64))
              .send({ nome: 'Cadastro Teste' })
              .expect(403);
            expect(servico[rota.operacao]).not.toHaveBeenCalled();
          });
        }
      }

      it('recusa nome vazio no cadastro', async () => {
        await request(app.getHttpServer())
          .post(base)
          .set('Cookie', cookie(GESTOR))
          .set('X-CSRF-Token', CSRF)
          .send({ nome: '   ' })
          .expect(400);
        expect(servico.criar).not.toHaveBeenCalled();
      });

      it('recusa ID invalido na edicao', async () => {
        await request(app.getHttpServer())
          .patch(`${base}/abc`)
          .set('Cookie', cookie(GESTOR))
          .set('X-CSRF-Token', CSRF)
          .send({ nome: 'Cadastro Teste' })
          .expect(400);
        expect(servico.alterar).not.toHaveBeenCalled();
      });
    });
  }
});
