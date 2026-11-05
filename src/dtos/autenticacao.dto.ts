import { BadRequestException } from '@nestjs/common';
import { corpo, textoObrigatorio, type Corpo } from '../utils/validacao.js';
import { validarNovaSenha } from '../utils/politica-senha.js';

export interface LoginDto {
  email: string;
  senha: string;
}

const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function lerEmail(dados: Corpo): string {
  const email = textoObrigatorio(dados, 'email').toLowerCase();

  if (!FORMATO_EMAIL.test(email)) {
    throw new BadRequestException('Informe um e-mail válido.');
  }

  return email;
}

export function lerLoginDto(body: unknown): LoginDto {
  const dados = corpo(body);
  const email = lerEmail(dados);

  // No login não se aplica a política de senha nova: só limita o tamanho para o Argon2
  if (
    typeof dados.senha !== 'string' ||
    dados.senha.length === 0 ||
    dados.senha.length > 128
  ) {
    throw new BadRequestException('Informe sua senha.');
  }

  return { email, senha: dados.senha };
}

export const lerEsqueciSenhaDto = (body: unknown): string =>
  lerEmail(corpo(body));

export function lerRedefinirSenhaDto(body: unknown): {
  token: string;
  senha: string;
} {
  const dados = corpo(body);

  if (typeof dados.token !== 'string' || !/^[a-f0-9]{64}$/.test(dados.token)) {
    throw new BadRequestException('Link inválido ou expirado. Peça um novo.');
  }

  return { token: dados.token, senha: validarNovaSenha(dados.senha) };
}
