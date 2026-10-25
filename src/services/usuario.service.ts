import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type {
  AlterarUsuarioDto,
  CriarUsuarioDto,
} from '../dtos/usuario.dto.js';
import { PrismaService } from './prisma.service.js';

const COM_COLABORADOR = {
  include: { colaborador: { select: { id: true, nome: true } } },
} as const;

@Injectable()
export class UsuarioService {
  constructor(private readonly prisma: PrismaService) {}

  listar(ativo: boolean) {
    return this.prisma.usuario.findMany({
      where: { ativo },
      orderBy: { nome: 'asc' },
      ...COM_COLABORADOR,
    });
  }

  /** Email repetido ou colaboradora já ligada a outro usuário viram 409 (PrismaErroFilter). */
  async criar(dto: CriarUsuarioDto) {
    await this.exigirColaborador(dto.colaboradorId);
    return this.prisma.usuario.create({ data: dto, ...COM_COLABORADOR });
  }

  async alterar(id: number, dto: AlterarUsuarioDto) {
    await this.exigirColaborador(dto.colaboradorId);
    return this.prisma.usuario.update({
      where: { id },
      data: dto,
      ...COM_COLABORADOR,
    });
  }

  /** Quem está no header X-Usuario-Id precisa existir e estar ativo para alterar dados. */
  async exigirAtivo(id: number): Promise<{ id: number; nome: string }> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id },
      select: { id: true, nome: true, ativo: true },
    });
    if (!usuario?.ativo) {
      throw new ForbiddenException(
        `O usuário ${id} (header X-Usuario-Id) não existe ou está inativo.`,
      );
    }
    return { id: usuario.id, nome: usuario.nome };
  }

  /** colaboradorId null ou ausente passa (desliga ou não mexe). */
  private async exigirColaborador(id: number | null | undefined) {
    if (!id) return;
    const existe = await this.prisma.colaborador.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existe) {
      throw new BadRequestException(`Colaborador ${id} não está cadastrado.`);
    }
  }
}
