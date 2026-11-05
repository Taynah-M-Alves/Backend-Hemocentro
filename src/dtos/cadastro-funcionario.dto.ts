import { BadRequestException } from '@nestjs/common';
import { PerfilUsuario } from '../generated/prisma/enums.js';
import { corpo } from '../utils/validacao.js';
import { validarNovaSenha } from '../utils/politica-senha.js';
import { lerCriarUsuarioDto } from './usuario.dto.js';
import type { CriarUsuarioDto } from './usuario.dto.js';

export interface CadastrarFuncionarioDto extends CriarUsuarioDto {
  /** Senha provisória: o funcionário troca no primeiro acesso. */
  senha: string;
  perfil: PerfilUsuario;
}

const CAMPOS_PERMITIDOS = new Set([
  'nome',
  'email',
  'colaboradorId',
  'senha',
  'perfil',
]);

export function lerCadastrarFuncionarioDto(
  body: unknown,
): CadastrarFuncionarioDto {
  const dados = corpo(body);

  for (const campo of Object.keys(dados)) {
    if (!CAMPOS_PERMITIDOS.has(campo)) {
      throw new BadRequestException(
        `O campo "${campo}" não é permitido no cadastro de funcionário.`,
      );
    }
  }

  return {
    ...lerCriarUsuarioDto(dados),
    senha: validarNovaSenha(dados.senha),
    perfil: lerPerfil(dados.perfil),
  };
}

function lerPerfil(valor: unknown): PerfilUsuario {
  if (valor === undefined) return PerfilUsuario.COLABORADOR;
  if (valor === PerfilUsuario.GESTOR || valor === PerfilUsuario.COLABORADOR) return valor;
  throw new BadRequestException('"perfil" precisa ser GESTOR ou COLABORADOR.');
}
