import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaService } from './prisma.service.js';

const DURACAO_SESSAO_MS = 4 * 60 * 60 * 1000;
const FORMATO_TOKEN = /^[a-f0-9]{64}$/;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function tokenDoCookie(requisicao: Request): string | undefined {
  const valor: unknown = requisicao.cookies?.hemocentro_sessao;
  return typeof valor === 'string' ? valor : undefined;
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

  /** Sessão do cookie + header X-CSRF-Token: 401 sem sessão válida, 403 com CSRF errado. */
  async exigir(token: string | undefined, csrf: string | undefined) {
    const sessao = await this.buscar(token);
    if (!sessao) {
      throw new UnauthorizedException(
        'Sessão inválida ou expirada. Entre novamente.',
      );
    }
    const recebido = Buffer.from(csrf ?? '', 'utf8');
    const esperado = Buffer.from(sessao.csrfToken, 'utf8');
    if (
      recebido.length !== esperado.length ||
      !timingSafeEqual(recebido, esperado)
    ) {
      throw new ForbiddenException('Token de proteção inválido.');
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
