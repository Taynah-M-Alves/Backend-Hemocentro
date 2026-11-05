import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSOES_PERMITIDAS } from '../decorators/permissoes-permitidas.decorator.js';
import { PerfilUsuario } from '../generated/prisma/enums.js';
import type { PermissaoUsuario } from '../generated/prisma/enums.js';
import type { RequisicaoAutenticada } from './autenticacao.guard.js';

@Injectable()
export class PermissoesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(contexto: ExecutionContext): boolean {
    const permitidas = this.reflector.getAllAndOverride<PermissaoUsuario[]>(
      PERMISSOES_PERMITIDAS,
      [contexto.getHandler(), contexto.getClass()],
    );

    if (permitidas === undefined) {
      return true;
    }

    const requisicao = contexto
      .switchToHttp()
      .getRequest<RequisicaoAutenticada>();

    const usuario = requisicao.sessaoAutenticada?.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'Sessão inválida ou expirada. Entre novamente.',
      );
    }

    if (usuario.perfil === PerfilUsuario.GESTOR) {
      return true;
    }

    const autorizado = permitidas.some((permissao) =>
      usuario.permissoes.includes(permissao),
    );

    if (!autorizado) {
      throw new ForbiddenException(
        'Você não possui permissão para realizar esta operação.',
      );
    }

    return true;
  }
}
