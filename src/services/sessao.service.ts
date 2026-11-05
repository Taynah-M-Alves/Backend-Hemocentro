import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from './prisma.service.js';

const DURACAO_SESSAO_MS = 8 * 60 * 60 * 1000;
const FORMATO_TOKEN = /^[a-f0-9]{64}$/;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class SessaoService {
  constructor(private readonly prisma: PrismaService) {}
  async criar(usuarioId: number) {
    const token = randomBytes(32).toString('hex');
    const csrfToken = randomBytes(32).toString('hex');
    const expiraEm = new Date(Date.now() + DURACAO_SESSAO_MS);

    await this.prisma.sessaoUsuario.create({
      data: {
        usuarioId,
        tokenHash: hashToken(token),
        csrfToken,
        expiraEm,
      },
    });

    return { token, csrfToken, expiraEm };
  }

  async buscar(token: string | undefined) {
    if (!token || !FORMATO_TOKEN.test(token)) return null;

    const sessao = await this.prisma.sessaoUsuario.findUnique({
      where: {
        tokenHash: hashToken(token),
      },
      select: {
        id: true,
        csrfToken: true,
        expiraEm: true,
        revogadaEm: true,
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
            ativo: true,
            perfil: true,
            permissoes: true,
          },
        },
      },
    });

    if (
      !sessao ||
      sessao.revogadaEm ||
      sessao.expiraEm.getTime() <= Date.now() ||
      !sessao.usuario.ativo
    ) {
      return null;
    }

    return sessao;
  }

  async revogar(token: string | undefined): Promise<void> {
    if (!token || !FORMATO_TOKEN.test(token)) return;

    await this.prisma.sessaoUsuario.updateMany({
      where: {
        tokenHash: hashToken(token),
        revogadaEm: null,
      },
      data: {
        revogadaEm: new Date(),
      },
    });
  }

  async revogarTodas(usuarioId: number): Promise<void> {
    await this.prisma.sessaoUsuario.updateMany({
      where: {
        usuarioId,
        revogadaEm: null,
      },
      data: {
        revogadaEm: new Date(),
      },
    });
  }
}
