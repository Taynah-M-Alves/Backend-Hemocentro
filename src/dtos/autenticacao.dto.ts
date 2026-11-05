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

  return { email, senha: senhaAtual(dados.senha, 'Informe sua senha.') };
}

// Senha já cadastrada: não se aplica a política de senha nova, só limita o tamanho para o Argon2
function senhaAtual(valor: unknown, mensagem: string): string {
  if (typeof valor !== 'string' || valor.length === 0 || valor.length > 128) {
    throw new BadRequestException(mensagem);
  }
  return valor;
}

/** POST /api/auth/trocar-senha { senhaAtual, novaSenha } */
export function lerTrocarSenhaDto(body: unknown): {
  senhaAtual: string;
  novaSenha: string;
} {
  const dados = corpo(body);
  const atual = senhaAtual(dados.senhaAtual, 'Informe a senha atual.');
  const novaSenha = validarNovaSenha(dados.novaSenha);
  if (novaSenha === atual) {
    throw new BadRequestException('A nova senha precisa ser diferente da atual.');
  }
  return { senhaAtual: atual, novaSenha };
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
