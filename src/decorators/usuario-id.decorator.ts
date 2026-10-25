import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

/**
 * Lê o header X-Usuario-Id: quem está usando o sistema (vira o autor na auditoria).
 * Provisório até existir login. `@UsuarioId(true)` deixa o header opcional (rotas de consulta).
 */
export const UsuarioId = createParamDecorator(
  (opcional: boolean | undefined, ctx: ExecutionContext): number | null => {
    const valor = ctx.switchToHttp().getRequest<Request>().headers['x-usuario-id'];
    if (valor === undefined && opcional) return null;

    const id = Number(valor);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new BadRequestException(
        'Envie o header X-Usuario-Id com o id do usuário que está usando o sistema.',
      );
    }
    return id;
  },
);
