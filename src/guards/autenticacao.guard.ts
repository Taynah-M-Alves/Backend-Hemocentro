import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { ROTA_PUBLICA } from '../decorators/rota-publica.decorator.js';
import { SessaoService } from '../services/sessao.service.js';

type SessaoAutenticada = NonNullable<
  Awaited<ReturnType<SessaoService['buscar']>>
>;

export type RequisicaoAutenticada = Request & {
  sessaoAutenticada?: SessaoAutenticada;
};

@Injectable()
export class AutenticacaoGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessoes: SessaoService,
  ) {}

  async canActivate(contexto: ExecutionContext): Promise<boolean> {
    const publica = this.reflector.getAllAndOverride<boolean>(
      ROTA_PUBLICA,
      [contexto.getHandler(), contexto.getClass()],
    );

    if (publica) {
      return true;
    }

    const requisicao =
      contexto.switchToHttp().getRequest<RequisicaoAutenticada>();

    const valorCookie: unknown = requisicao.cookies?.hemocentro_sessao;
    const token = typeof valorCookie === 'string' ? valorCookie : undefined;
    const sessao = await this.sessoes.buscar(token);

    if (!sessao) {
      throw new UnauthorizedException(
        'Sessão inválida ou expirada. Entre novamente.',
      );
    }

    const consulta = ['GET', 'HEAD', 'OPTIONS'].includes(requisicao.method);

    if (!consulta) {
      const origensPermitidas = (
        process.env.CORS_ORIGINS ?? 'http://localhost:8080,http://localhost:8081'
      )
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);

      const origem = requisicao.get('origin');

      if (origem && !origensPermitidas.includes(origem)) {
        throw new ForbiddenException('Origem não permitida.');
      }

      const csrfRecebido = requisicao.get('x-csrf-token');

      if (
        typeof csrfRecebido !== 'string' ||
        !/^[a-f0-9]{64}$/.test(csrfRecebido)
      ) {
        throw new ForbiddenException('Token de proteção inválido.');
      }

      const recebido = Buffer.from(csrfRecebido, 'utf8');
      const esperado = Buffer.from(sessao.csrfToken, 'utf8');

      if (
        recebido.length !== esperado.length ||
        !timingSafeEqual(recebido, esperado)
      ) {
        throw new ForbiddenException('Token de proteção inválido.');
      }
    }

    requisicao.sessaoAutenticada = sessao;

    return true;
  }
}