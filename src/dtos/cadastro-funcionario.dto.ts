import { BadRequestException } from '@nestjs/common';
import { corpo } from '../utils/validacao.js';
import { validarNovaSenha } from '../utils/politica-senha.js';
import { lerCriarUsuarioDto } from './usuario.dto.js';
import type { CriarUsuarioDto } from './usuario.dto.js';

export interface CadastrarFuncionarioDto extends CriarUsuarioDto {
  /** Senha provisória: o funcionário troca no primeiro acesso. */
  senha: string;
}

const CAMPOS_PERMITIDOS = new Set([
  'nome',
  'email',
  'colaboradorId',
  'senha',
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
  };
}
