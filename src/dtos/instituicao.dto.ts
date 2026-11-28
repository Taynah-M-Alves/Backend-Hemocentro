import { BadRequestException } from '@nestjs/common';
import { corpo, textoObrigatorio } from '../utils/validacao.js';

export interface InstituicaoDto {
  nome: string;
}

export function lerInstituicaoDto(body: unknown): InstituicaoDto {
  const dados = corpo(body);

  if (Object.keys(dados).some((campo) => campo !== 'nome')) {
    throw new BadRequestException('Informe somente o campo "nome".');
  }

  return {
    nome: textoObrigatorio(dados, 'nome').replace(/\s+/g, ' '),
  };
}
