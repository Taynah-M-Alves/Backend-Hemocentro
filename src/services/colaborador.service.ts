import { BadRequestException, Injectable } from '@nestjs/common';
import type { CriarColaboradorDto } from '../dtos/colaborador.dto.js';
import { contem } from '../utils/formatos.js';
import { PrismaService } from './prisma.service.js';

@Injectable()
export class ColaboradorService {
  constructor(private readonly prisma: PrismaService) {}

  async buscar(busca: string | undefined) {
    if (!busca || busca.trim().length < 2) {
      throw new BadRequestException('"busca" precisa ter pelo menos 2 letras.');
    }
    const colaboradores = await this.prisma.colaborador.findMany({
      where: { nome: contem(busca.trim()) },
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

  criar(dto: CriarColaboradorDto) {
    return this.prisma.colaborador.create({ data: dto });
  }
}
