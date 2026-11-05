import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AlterarUsuarioDto } from '../dtos/usuario.dto.js';
import type { CadastrarFuncionarioDto } from '../dtos/cadastro-funcionario.dto.js';
import { PerfilUsuario } from '../generated/prisma/enums.js';
import { PrismaService } from './prisma.service.js';

const USUARIO_PUBLICO = {
  select: {
    id: true,
    nome: true,
    email: true,
    ativo: true,
    perfil: true,
    permissoes: true,
    colaboradorId: true,
    colaborador: {
      select: {
        id: true,
        nome: true,
      },
    },
  },
} as const;

@Injectable()
export class UsuarioService {
  constructor(private readonly prisma: PrismaService) {}

  listar(ativo: boolean) {
    return this.prisma.usuario.findMany({
      where: { ativo },
      orderBy: { nome: 'asc' },
      ...USUARIO_PUBLICO,
    });
  }

  /** E-mail ou vínculo repetido são tratados como 409 pelo filtro do Prisma. */
  async criar(dto: CadastrarFuncionarioDto) {
    await this.exigirColaborador(dto.colaboradorId);

    return this.prisma.usuario.create({
      data: {
        nome: dto.nome,
        email: dto.email,
        colaboradorId: dto.colaboradorId,
        permissoes: dto.permissoes,
        perfil: PerfilUsuario.COLABORADOR,
        ativo: true,
        senhaHash: null,
      },
      ...USUARIO_PUBLICO,
    });
  }

  async alterar(id: number, dto: AlterarUsuarioDto) {
    await this.exigirColaborador(dto.colaboradorId);
    return this.prisma.usuario.update({
      where: { id },
      data: dto,
      ...USUARIO_PUBLICO,
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
