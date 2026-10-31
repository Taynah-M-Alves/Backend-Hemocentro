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

  async buscar(busca?: string) {
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
      where,
      orderBy: { nome: 'asc' },
      take: 20,
      include: { usuario: { select: { id: true } } },
    });
    return colaboradores.map(({ id, nome, usuario }) => ({
      id,
      nome,
      usuarioId: usuario?.id ?? null,
    }));
  }

  // shortcut: sem índice único no banco, dois cadastros simultâneos podem passar; trocar por @@unique se virar problema.
  async criar(dto: CriarColaboradorDto) {
    const [existe] = await this.prisma.$queryRaw<{ id: number }[]>`
      SELECT id FROM colaborador WHERE unaccent(lower(nome)) = unaccent(lower(${dto.nome})) LIMIT 1`;
    if (existe) {
      throw new ConflictException(
        `Já existe colaborador com o nome "${dto.nome}".`,
      );
    }
    return this.prisma.colaborador.create({ data: dto });
  }
}
