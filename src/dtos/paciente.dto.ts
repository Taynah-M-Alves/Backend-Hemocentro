import { BadRequestException } from '@nestjs/common';
import { paginacao, type Paginacao } from '../utils/paginacao.js';
import { dataDaQuery, idDaQuery } from '../utils/validacao.js';

/** GET /api/pacientes — pelo menos um filtro é obrigatório. */
export interface BuscarPacientesDto {
  nome?: string;
  dataNascimento?: string;
  nomeMae?: string;
  prontuario?: number;
  paginacao: Paginacao;
}

export function lerBuscarPacientesDto(
  q: Record<string, string | undefined>,
): BuscarPacientesDto {
  const dto = {
    nome: q.nome?.trim() || undefined,
    dataNascimento: dataDaQuery(q.dataNascimento, 'dataNascimento'),
    nomeMae: q.nomeMae?.trim() || undefined,
    prontuario: idDaQuery(q.prontuario, 'prontuario'),
  };
  if (Object.values(dto).every((v) => v === undefined)) {
    throw new BadRequestException(
      'Informe pelo menos um filtro: nome, dataNascimento, nomeMae ou prontuario.',
    );
  }
  return { ...dto, paginacao: paginacao(q.pagina, q.limite) };
}
