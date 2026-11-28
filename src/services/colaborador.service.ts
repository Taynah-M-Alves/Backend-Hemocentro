import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import type { CriarColaboradorDto } from '../dtos/colaborador.dto.js';
import { PrismaService } from './prisma.service.js';
@Injectable()
export class ColaboradorService {
  constructor(private readonly prisma: PrismaService) {}

  async buscar(busca?: string, ativo?: boolean) {
    const termo = busca?.trim();

    if (termo && termo.length < 2) {
      throw new BadRequestException('"busca" precisa ter pelo menos 2 letras.');
    }

    // Sem diferenciar maiúsculas nem acentos (unaccent do Postgres): "marcia" acha "Márcia"
    const where = termo
      ? {
          id: {
            in: (
              await this.prisma.$queryRaw<{ id: number }[]>`
                SELECT id FROM colaborador
                WHERE unaccent(nome) ILIKE unaccent(${`%${termo.replace(/[\\%_]/g, '\\$&')}%`})`
            ).map((c) => c.id),
          },
        }
      : {};

    const colaboradores = await this.prisma.colaborador.findMany({
      where: { ...where, ativo },
      orderBy: { nome: 'asc' },
      take: 20,
      include: { usuario: { select: { id: true } } },
    });
    return colaboradores.map(({ id, nome, ativo, usuario }) => ({
      id,
      nome,
      ativo,
      usuarioId: usuario?.id ?? null,
    }));
  }

  /** Administração: lista todos, sem o limite da busca das fichas. */
  async listarGerenciamento() {
    const colaboradores = await this.prisma.colaborador.findMany({
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        ativo: true,
        usuario: { select: { id: true } },
      },
    });

    return colaboradores.map(({ id, nome, ativo, usuario }) => ({
      id,
      nome,
      ativo,
      usuarioId: usuario?.id ?? null,
    }));
  }

  criar(dto: CriarColaboradorDto) {
    return this.salvar(dto);
  }

  /** 404 se não existir (filtro do Prisma); 409 se outro colaborador já tiver o nome. */
  alterar(id: number, dto: CriarColaboradorDto) {
    return this.salvar(dto, id);
  }

  definirAtivo(id: number, ativo: boolean) {
    return this.prisma.colaborador.update({ where: { id }, data: { ativo } });
  }

  /** Confere e grava na mesma transação, impedindo duplicatas simultâneas por estas rotas. */
  private salvar(dto: CriarColaboradorDto, id?: number) {
    return this.prisma.$transaction(
      async (tx) => {
        const [existe] = await tx.$queryRaw<{ id: number }[]>`
          SELECT id FROM colaborador
          WHERE unaccent(lower(trim(nome))) = unaccent(lower(trim(${dto.nome})))
            AND id <> ${id ?? 0}
          LIMIT 1`;
        if (existe) {
          throw new ConflictException(
            `Já existe colaborador com o nome "${dto.nome}", ativo ou inativo.`,
          );
        }
        return id === undefined
          ? tx.colaborador.create({ data: dto })
          : tx.colaborador.update({ where: { id }, data: dto });
      },
      { isolationLevel: 'Serializable' },
    );
  }
}
