import { BadRequestException } from '@nestjs/common';
import { corpo, textoObrigatorio } from '../utils/validacao.js';
import { validarNovaSenha } from '../utils/politica-senha.js';

export interface LoginDto {
  email: string;
  senha: string;
}

const FORMATO_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function lerLoginDto(body: unknown): LoginDto {
  const dados = corpo(body);
  const email = textoObrigatorio(dados, 'email').toLowerCase();

  if (!FORMATO_EMAIL.test(email)) {
    throw new BadRequestException('Informe um e-mail válido.');
  }

  if (typeof dados.senha !== 'string' || dados.senha.length === 0) {
    throw new BadRequestException('Informe sua senha.');
  }

  const senha = validarNovaSenha(dados.senha);

  return { email, senha };
}
