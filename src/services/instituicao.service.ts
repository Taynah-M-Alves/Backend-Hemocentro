import { ConflictException, Injectable } from '@nestjs/common';
import type { InstituicaoDto } from '../dtos/instituicao.dto.js';
import { PrismaService } from './prisma.service.js';

@Injectable()
export class InstituicaoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Opções disponíveis nas fichas. Mantém o contrato existente. */
  listar() {
    return this.prisma.instituicao.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    });
  }

  /** Administração: inclui ativos e inativos. */
  listarGerenciamento() {
    return this.prisma.instituicao.findMany({
      select: { id: true, nome: true, ativo: true },
      orderBy: { nome: 'asc' },
    });
  }

  criar(dto: InstituicaoDto) {
    return this.salvar(dto);
  }

  alterar(id: number, dto: InstituicaoDto) {
    return this.salvar(dto, id);
  }

  definirAtivo(id: number, ativo: boolean) {
    return this.prisma.instituicao.update({
      where: { id },
      data: { ativo },
    });
  }

  private salvar(dto: InstituicaoDto, id?: number) {
    return this.prisma.$transaction(
      async (tx) => {
        const [existente] = await tx.$queryRaw<{ id: number }[]>`
          SELECT id
          FROM instituicao
          WHERE unaccent(lower(trim(nome))) =
                unaccent(lower(trim(${dto.nome})))
            AND id <> ${id ?? 0}
          LIMIT 1
        `;

        if (existente) {
          throw new ConflictException(
            'Já existe uma instituição com esse nome, ativa ou inativa.',
          );
        }

        if (id !== undefined) {
          return tx.instituicao.update({
            where: { id },
            data: { nome: dto.nome },
          });
        }

        return tx.instituicao.create({
          data: { nome: dto.nome },
        });
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
