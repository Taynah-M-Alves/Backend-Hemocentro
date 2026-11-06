import { BadRequestException } from '@nestjs/common';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { PerfilUsuario } from '../generated/prisma/enums.js';
import { lerCriarUsuarioDto } from '../dtos/usuario.dto.js';
import { PrismaService } from '../services/prisma.service.js';
import { SenhaService } from '../services/senha.service.js';
import { validarNovaSenha } from '../utils/politica-senha.js';

class ErroInicializacao extends Error {}

async function executar(): Promise<void> {
  try {
    process.loadEnvFile();
  } catch {
    // sem .env, usa as variáveis do sistema (igual ao servidor)
  }

  if (!process.env.DATABASE_URL) {
    throw new ErroInicializacao('Configure DATABASE_URL no arquivo .env.');
  }

  const prisma = new PrismaService();
  const senhas = new SenhaService();
  let ocultarDigitacao = false;

  const saida = new Writable({
    write(trecho, codificacao, concluir) {
      if (!ocultarDigitacao) {
        process.stdout.write(trecho, codificacao);
      }
      concluir();
    },
  });

  const leitor = createInterface({
    input: process.stdin,
    output: saida,
    terminal: true,
    historySize: 0,
  });

  const cancelamento = new AbortController();
  leitor.on('SIGINT', () => cancelamento.abort());

  const perguntar = (texto: string) =>
    leitor.question(texto, { signal: cancelamento.signal });

  async function perguntarSenha(texto: string): Promise<string> {
    process.stdout.write(texto);
    ocultarDigitacao = true;

    try {
      return await perguntar('');
    } finally {
      ocultarDigitacao = false;
      process.stdout.write('\n');
    }
  }

  try {
    const existente = await prisma.usuario.findFirst({
      where: { perfil: PerfilUsuario.GESTOR },
      select: { id: true },
    });

    if (existente) {
      throw new ErroInicializacao(
        'Já existe um gestor. Este script é apenas para a configuração inicial.',
      );
    }

    const dados = lerCriarUsuarioDto({
      nome: await perguntar('Nome do gestor: '),
      email: await perguntar('E-mail do gestor: '),
    });

    const senha = validarNovaSenha(
      await perguntarSenha('Senha (digitação oculta): '),
    );

    const confirmacao = await perguntarSenha('Confirme a senha: ');

    if (senha !== confirmacao) {
      throw new ErroInicializacao('As senhas não coincidem.');
    }

    const senhaHash = await senhas.gerarHash(senha);

    const gestor = await prisma.$transaction(
      async (tx) => {
        const outroGestor = await tx.usuario.findFirst({
          where: { perfil: PerfilUsuario.GESTOR },
          select: { id: true },
        });

        if (outroGestor) {
          throw new ErroInicializacao('Já existe um gestor cadastrado.');
        }

        const emailCadastrado = await tx.usuario.findUnique({
          where: { email: dados.email },
          select: { id: true },
        });

        if (emailCadastrado) {
          throw new ErroInicializacao(
            'Este e-mail já está cadastrado. Nenhuma conta foi alterada.',
          );
        }

        return tx.usuario.create({
          data: {
            nome: dados.nome,
            email: dados.email,
            senhaHash,
            perfil: PerfilUsuario.GESTOR,
            ativo: true,
          },
          select: {
            id: true,
            nome: true,
            email: true,
            perfil: true,
          },
        });
      },
      { isolationLevel: 'Serializable', timeout: 10000 },
    );

    console.log('\nGestor criado com sucesso:');
    console.log(gestor);
  } finally {
    leitor.close();
    await prisma.$disconnect();
  }
}

void executar().catch((erro: unknown) => {
  if (
    erro instanceof ErroInicializacao ||
    erro instanceof BadRequestException
  ) {
    console.error(erro.message);
  } else if (erro instanceof Error && erro.name === 'AbortError') {
    console.error('Operação cancelada.');
  } else {
    console.error(
      'Falha na inicialização. Confira o .env, a conexão e a estrutura do banco.',
    );
  }

  process.exitCode = 1;
});
