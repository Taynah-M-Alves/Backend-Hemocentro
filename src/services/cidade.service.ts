import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Injectable()
export class CidadeService {
  constructor(private readonly prisma: PrismaService) {}

  async buscar(busca?: string, uf?: string) {
    // O Prisma não ignora acentos: o unaccent do Postgres acha "Cuiabá" com "cuiaba"
    const ids = busca
      ? (
          await this.prisma.$queryRaw<{ id: number }[]>`
            SELECT id FROM cidade
            WHERE unaccent(nome_cidade) ILIKE unaccent(${`%${busca.trim().replace(/[\\%_]/g, '\\$&')}%`})`
        ).map((c) => c.id)
      : undefined;
    return this.prisma.cidade.findMany({
      where: {
        ...(ids && { id: { in: ids } }),
        ...(uf && {
          estados: {
            uf: uf.trim().toUpperCase(),
          },
        }),
      },
      include: {
        estados: true, // opcional, caso queira trazer os dados do estado junto
      },
      orderBy: [{ nomeCidade: 'asc' }],
      take: 20,
    });
  }
}