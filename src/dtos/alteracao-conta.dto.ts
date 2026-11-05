import { BadRequestException } from '@nestjs/common';
import { PerfilUsuario, PermissaoUsuario } from '../generated/prisma/enums.js';
import {
  booleanoOpcional,
  corpo,
  idOpcional,
  textoObrigatorio,
} from '../utils/validacao.js';

export interface AlterarContaDto {
  nome?: string;
  ativo?: boolean;
  colaboradorId?: number | null;
  perfil?: PerfilUsuario;
  permissoes?: PermissaoUsuario[];
}

const CAMPOS_PERMITIDOS = new Set([
  'nome',
  'ativo',
  'colaboradorId',
  'perfil',
  'permissoes',
]);

const PERFIS_VALIDOS = Object.values(PerfilUsuario);
const PERMISSOES_VALIDAS = Object.values(PermissaoUsuario);

export function lerAlterarContaDto(body: unknown): AlterarContaDto {
  const dados = corpo(body);

  for (const campo of Object.keys(dados)) {
    if (!CAMPOS_PERMITIDOS.has(campo)) {
      throw new BadRequestException(
        `O campo "${campo}" não é permitido na alteração da conta.`,
      );
    }
  }

  const dto: AlterarContaDto = {};

  if ('nome' in dados) {
    dto.nome = textoObrigatorio(dados, 'nome');
  }

  if ('ativo' in dados) {
    dto.ativo = booleanoOpcional(dados, 'ativo');
  }

  if ('colaboradorId' in dados) {
    dto.colaboradorId = idOpcional(dados, 'colaboradorId');
  }

  if ('perfil' in dados) {
    if (
      typeof dados.perfil !== 'string' ||
      !PERFIS_VALIDOS.includes(dados.perfil as PerfilUsuario)
    ) {
      throw new BadRequestException('Perfil de usuário inválido.');
    }

    dto.perfil = dados.perfil as PerfilUsuario;
  }

  if ('permissoes' in dados) {
    if (!Array.isArray(dados.permissoes)) {
      throw new BadRequestException('"permissoes" precisa ser uma lista.');
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

    dto.permissoes = [...new Set(permissoes)];
  }

  if (Object.values(dto).every((valor) => valor === undefined)) {
    throw new BadRequestException('Informe pelo menos um campo para alterar.');
  }

  return dto;
}
