import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { lerCriarColaboradorDto } from '../src/dtos/colaborador.dto.js';
import { lerInstituicaoDto } from '../src/dtos/instituicao.dto.js';
import { ColaboradorService } from '../src/services/colaborador.service.js';
import { InstituicaoService } from '../src/services/instituicao.service.js';
import type { PrismaService } from '../src/services/prisma.service.js';

// Execucao explicita: node --env-file=.env ./node_modules/vitest/vitest.mjs run --config vitest.config.postgres.ts
// Cria e remove APENAS um schema aleatorio de teste. Nunca limpa tabelas public.
const schema = `hemocentro_teste_aux_${randomBytes(8).toString('hex')}`;
const prefixoSeguro = /^hemocentro_teste_aux_[a-f0-9]{16}$/;
let administrador: pg.Client | undefined;
let cliente: PrismaClient | undefined;
let criado = false;
let contagensAntes: unknown;
let instituicoes: InstituicaoService;
let colaboradores: ColaboradorService;

async function contagensPublicas() {
  return (
    await administrador!.query(`
    SELECT (SELECT count(*)::int FROM public.instituicao) AS instituicoes,
           (SELECT count(*)::int FROM public.colaborador) AS colaboradores,
           (SELECT count(*)::int FROM public.ficha_transfusional) AS transfusoes,
           (SELECT count(*)::int FROM public.usuario) AS usuarios
  `)
  ).rows;
}

beforeAll(async () => {
  if (!process.env.DATABASE_URL)
    throw new Error('DATABASE_URL ausente: execute com --env-file=.env.');
  const endereco = new URL(process.env.DATABASE_URL);
  if (
    !['127.0.0.1', 'localhost'].includes(endereco.hostname) ||
    endereco.pathname !== '/hemocentro_dev'
  ) {
    throw new Error(
      'Este teste aceita apenas hemocentro_dev no PostgreSQL local.',
    );
  }
  if (!prefixoSeguro.test(schema))
    throw new Error('Nome de schema de teste invalido.');
  // Impede que parametros da URL sobrescrevam o isolamento da conexao de testes.
  endereco.searchParams.delete('schema');
  endereco.searchParams.delete('options');
  const connectionString = endereco.toString();
  administrador = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 5000,
  });
  await administrador.connect();
  const extensao = await administrador.query(
    "SELECT 1 FROM pg_extension e JOIN pg_namespace n ON e.extnamespace=n.oid WHERE e.extname='unaccent' AND n.nspname='public'",
  );
  if (extensao.rowCount !== 1)
    throw new Error('O teste requer unaccent ja instalado no schema public.');
  contagensAntes = await contagensPublicas();
  await administrador.query(`CREATE SCHEMA "${schema}"`);
  criado = true;
  await administrador.query(`SET search_path TO "${schema}", public`);

  // Reproduz o MODELO atual, sem executar seeds ou migrations sobre o banco existente.
  let ddl = execFileSync(
    process.execPath,
    [
      './node_modules/prisma/build/index.js',
      'migrate',
      'diff',
      '--from-empty',
      '--to-schema',
      'prisma/schema.prisma',
      '--script',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
  ddl = ddl
    .replaceAll('"public"', `"${schema}"`)
    .replace(/CREATE EXTENSION IF NOT EXISTS "unaccent";/g, '');
  await administrador.query(ddl);
  cliente = new PrismaClient({
    adapter: new PrismaPg(
      { connectionString, options: `-c search_path=${schema},public` },
      { schema },
    ),
  });
  await cliente.$connect();
  const [ambiente] = await cliente.$queryRaw<
    { schema: string }[]
  >`SELECT current_schema() AS schema`;
  if (ambiente.schema !== schema)
    throw new Error('A conexao nao esta isolada no schema de testes.');
  instituicoes = new InstituicaoService(cliente as PrismaService);
  colaboradores = new ColaboradorService(cliente as PrismaService);
});

afterAll(async () => {
  await cliente?.$disconnect();
  if (!administrador) return;
  try {
    // O identificador e gerado neste arquivo; nunca vem de entrada externa.
    if (criado && prefixoSeguro.test(schema)) {
      await administrador.query(`DROP SCHEMA "${schema}" CASCADE`);
      criado = false;
      expect(await contagensPublicas()).toEqual(contagensAntes);
      const restante = await administrador.query(
        'SELECT 1 FROM pg_namespace WHERE nspname=$1',
        [schema],
      );
      expect(restante.rowCount).toBe(0);
    }
  } finally {
    await administrador.end();
  }
});

for (const tipo of ['instituicoes', 'colaboradores'] as const) {
  describe(`${tipo}: persistencia no PostgreSQL isolado`, () => {
    const nome = (sufixo: string) => `${tipo} ${sufixo}`;
    const servico = () =>
      tipo === 'instituicoes' ? instituicoes : colaboradores;
    const dados = (valor: string) =>
      tipo === 'instituicoes'
        ? lerInstituicaoDto({ nome: valor })
        : lerCriarColaboradorDto({ nome: valor });
    const listarAtivos = () =>
      tipo === 'instituicoes'
        ? instituicoes.listar()
        : colaboradores.buscar(undefined, true);
    const registros = (valor: string) => cliente!.$queryRaw<
      { quantidade: number }[]
    >`
      SELECT count(*)::int AS quantidade FROM (
        SELECT nome FROM instituicao WHERE ${tipo} = 'instituicoes'
        UNION ALL SELECT nome FROM colaborador WHERE ${tipo} = 'colaboradores'
      ) t WHERE unaccent(lower(trim(nome)))=unaccent(lower(trim(${valor})))
    `;

    it('cria e edita mantendo o ID', async () => {
      const salvo = await servico().criar(dados(nome('Criacao')));
      expect(salvo.ativo).toBe(true);
      const alterado = await servico().alterar(salvo.id, dados(nome('Edicao')));
      expect(alterado.id).toBe(salvo.id);
      expect(alterado.nome).toBe(dados(nome('Edicao')).nome);
      const semTrocaDeId = await servico().alterar(
        salvo.id,
        dados(nome('Edicao').toUpperCase()),
      );
      expect(semTrocaDeId.id).toBe(salvo.id);
    });

    it('recusa duplicidade sem diferenciar acentos e maiusculas, inclusive inativo', async () => {
      const salvo = await servico().criar(dados(nome('São Áureo')));
      await expect(
        servico().criar(dados(nome('SAO AUREO'))),
      ).rejects.toBeInstanceOf(ConflictException);
      await servico().definirAtivo(salvo.id, false);
      await expect(
        servico().criar(dados(nome('sao aureo'))),
      ).rejects.toBeInstanceOf(ConflictException);
      expect((await registros(nome('sao aureo')))[0].quantidade).toBe(1);
    });

    it('recusa edicao para nome de outro registro e preserva o nome original', async () => {
      await servico().criar(dados(nome('Destino Ocupado')));
      const outro = await servico().criar(dados(nome('Nome Original')));
      await expect(
        servico().alterar(outro.id, dados(nome('Destino Ocupado'))),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(
        (await servico().listarGerenciamento()).find((r) => r.id === outro.id)
          ?.nome,
      ).toBe(outro.nome);
    });

    it('inativa e reativa: sai das opcoes, permanece no gerenciamento e conserva ID', async () => {
      const salvo = await servico().criar(dados(nome('Situacao')));
      expect((await listarAtivos()).some((r) => r.id === salvo.id)).toBe(true);
      await servico().definirAtivo(salvo.id, false);
      expect((await listarAtivos()).some((r) => r.id === salvo.id)).toBe(false);
      expect(
        (await servico().listarGerenciamento()).find((r) => r.id === salvo.id)
          ?.ativo,
      ).toBe(false);
      const reativado = await servico().definirAtivo(salvo.id, true);
      expect(reativado.id).toBe(salvo.id);
      expect((await listarAtivos()).some((r) => r.id === salvo.id)).toBe(true);
    });

    it('nao cria duplicatas em requisicoes simultaneas', async () => {
      const valor = nome('Concorrencia');
      const resultados = await Promise.allSettled(
        Array.from({ length: 6 }, () => servico().criar(dados(valor))),
      );
      expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(
        1,
      );
      expect((await registros(valor))[0].quantidade).toBe(1);
    });

    it('reporta registro inexistente na edicao e na alteracao de situacao', async () => {
      await expect(
        servico().alterar(2147483647, dados(nome('Inexistente'))),
      ).rejects.toMatchObject({ code: 'P2025' });
      await expect(
        servico().definirAtivo(2147483647, false),
      ).rejects.toMatchObject({ code: 'P2025' });
    });
  });
}

it('preserva vinculos de transfusao e conta de acesso ao inativar os cadastros auxiliares', async () => {
  const unidade = await instituicoes.criar({
    nome: 'Hospital Vinculado Teste',
  });
  const profissional = await colaboradores.criar({
    nome: 'Profissional Vinculado Teste',
  });
  const paciente = await cliente!.paciente.create({
    data: { nome: 'Paciente Ficticio de Teste' },
  });
  const usuario = await cliente!.usuario.create({
    data: {
      nome: 'Conta de Teste',
      email: 'conta@example.invalid',
      colaboradorId: profissional.id,
    },
  });
  const transfusao = await cliente!.fichaTransfusional.create({
    data: {
      pacienteId: paciente.id,
      dataEnvio: new Date('2026-01-01T00:00:00Z'),
      tipoHemocomponente: 'TESTE',
      numeroDoacao: 'BOLSA-TESTE-ISOLADO',
      grsRhd: 'O_POSITIVO',
      volMl: 250,
      testesPai: 'NAO_REALIZADO',
      provaCruzada: 'NAO_REALIZADO',
      instituicaoDestinoId: unidade.id,
      responsavelLiberacaoId: profissional.id,
    },
  });
  await instituicoes.definirAtivo(unidade.id, false);
  await colaboradores.definirAtivo(profissional.id, false);
  const persistido = await cliente!.fichaTransfusional.findUniqueOrThrow({
    where: { id: transfusao.id },
    include: { instituicaoDestino: true, responsavelLiberacao: true },
  });
  expect(persistido.instituicaoDestino?.id).toBe(unidade.id);
  expect(persistido.instituicaoDestino?.ativo).toBe(false);
  expect(persistido.responsavelLiberacao?.id).toBe(profissional.id);
  expect(persistido.responsavelLiberacao?.ativo).toBe(false);
  const conta = await cliente!.usuario.findUniqueOrThrow({
    where: { id: usuario.id },
  });
  expect(conta.colaboradorId).toBe(profissional.id);
  expect(conta.ativo).toBe(true);
});

it('gerenciamento de colaboradores nao omite registros acima de 20', async () => {
  const ids: number[] = [];
  for (let i = 0; i < 23; i++) {
    ids.push(
      (await colaboradores.criar({ nome: `Profissional Listagem ${i}` })).id,
    );
  }
  const listados = await colaboradores.listarGerenciamento();
  expect(ids.every((id) => listados.some((r) => r.id === id))).toBe(true);
});

it('busca de colaboradores considera acentos e trata curingas como texto literal', async () => {
  const acentuado = await colaboradores.criar({ nome: 'Márcia da Busca' });
  const literal = await colaboradores.criar({
    nome: 'Profissional 100%_Literal',
  });
  expect(
    (await colaboradores.buscar('marcia', true)).map((r) => r.id),
  ).toContain(acentuado.id);
  expect((await colaboradores.buscar('%_', true)).map((r) => r.id)).toEqual([
    literal.id,
  ]);
  await colaboradores.definirAtivo(acentuado.id, false);
  expect(await colaboradores.buscar('marcia', true)).toEqual([]);
});
