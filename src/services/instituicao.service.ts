import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Injectable()
export class InstituicaoService {
  constructor(private readonly prisma: PrismaService) {}

  /** Só as ativas, para o select de destino da transfusão. */
  listar() {
    return this.prisma.instituicao.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    });
  }
}
