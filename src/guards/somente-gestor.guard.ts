import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { PerfilUsuario } from '../generated/prisma/enums.js';
import type { RequisicaoAutenticada } from './autenticacao.guard.js';

@Injectable()
export class SomenteGestorGuard implements CanActivate {
  canActivate(contexto: ExecutionContext): boolean {
    const requisicao =
      contexto.switchToHttp().getRequest<RequisicaoAutenticada>();

    const usuario = requisicao.sessaoAutenticada?.usuario;

    if (!usuario) {
      throw new UnauthorizedException(
        'Sessão inválida ou expirada. Entre novamente.',
      );
    }

    if (usuario.perfil !== PerfilUsuario.GESTOR) {
      throw new ForbiddenException(
        'Esta operação é permitida somente ao gestor.',
      );
    }

    return true;
  }
}