import { Injectable } from '@nestjs/common';
import { contem } from '../utils/formatos.js';
import { PrismaService } from './prisma.service.js';

@Injectable()
export class CidadeService {
  constructor(private readonly prisma: PrismaService) {}

  buscar(busca?: string, uf?: string) {
    return this.prisma.cidade.findMany({
      where: {
        ...(busca && { nomeCidade: contem(busca.trim()) }),
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