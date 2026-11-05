import { BadRequestException } from '@nestjs/common';
import { PermissaoUsuario } from '../generated/prisma/enums.js';
import { corpo } from '../utils/validacao.js';
import { lerCriarUsuarioDto } from './usuario.dto.js';
import type { CriarUsuarioDto } from './usuario.dto.js';

export interface CadastrarFuncionarioDto extends CriarUsuarioDto {
  permissoes: PermissaoUsuario[];
}

const CAMPOS_PERMITIDOS = new Set([
  'nome',
  'email',
  'colaboradorId',
  'permissoes',
]);

const PERMISSOES_VALIDAS = Object.values(PermissaoUsuario);

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

  if (!Array.isArray(dados.permissoes)) {
    throw new BadRequestException(
      '"permissoes" precisa ser uma lista.',
    );
  }

  if (dados.permissoes.length > PERMISSOES_VALIDAS.length) {
    throw new BadRequestException(
      'A lista de permissões excede o limite permitido.',
    );
  }

  const permissoes = dados.permissoes.map((valor: unknown) => {
    if (
      typeof valor !== 'string' ||
      !PERMISSOES_VALIDAS.includes(valor as PermissaoUsuario)
    ) {
      throw new BadRequestException('A lista contém uma permissão inválida.');
    }

    return valor as PermissaoUsuario;
  });

  return {
    ...lerCriarUsuarioDto(dados),
    permissoes: [...new Set(permissoes)],
  };
}