import { BadRequestException } from '@nestjs/common';
import {
  booleanoOpcional,
  corpo,
  idOpcional,
  textoObrigatorio,
  textoOpcional,
} from '../utils/validacao.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** POST /api/usuarios */
export interface CriarUsuarioDto {
  nome: string;
  email: string;
  colaboradorId?: number | null;
}

/** PATCH /api/usuarios/:id (todos opcionais; colaboradorId null desliga a colaboradora) */
export interface AlterarUsuarioDto {
  nome?: string;
  ativo?: boolean;
  colaboradorId?: number | null;
}

export function lerCriarUsuarioDto(body: unknown): CriarUsuarioDto {
  const c = corpo(body);
  const email = textoObrigatorio(c, 'email').toLowerCase();
  if (!EMAIL.test(email)) throw new BadRequestException('"email" inválido.');
  return {
    nome: textoObrigatorio(c, 'nome'),
    email,
    colaboradorId: idOpcional(c, 'colaboradorId'),
  };
}

export function lerAlterarUsuarioDto(body: unknown): AlterarUsuarioDto {
  const c = corpo(body);
  return {
    nome: textoOpcional(c, 'nome'),
    ativo: booleanoOpcional(c, 'ativo'),
    colaboradorId: idOpcional(c, 'colaboradorId'),
  };
}
