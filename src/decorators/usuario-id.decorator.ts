import {
  createParamDecorator,
  UnauthorizedException,
} from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { RequisicaoAutenticada } from '../guards/autenticacao.guard.js';

/**
 * Obtém o usuário da sessão validada pelo guard.
 * O argumento antigo permanece compatível com os controllers,
 * mas não torna mais a autenticação opcional.
 */
export const UsuarioId = createParamDecorator(
  (_opcional: boolean | undefined, contexto: ExecutionContext): number => {
    const requisicao =
      contexto.switchToHttp().getRequest<RequisicaoAutenticada>();

    const usuarioId = requisicao.sessaoAutenticada?.usuario.id;

    if (!usuarioId) {
      throw new UnauthorizedException(
        'Sessão inválida ou expirada. Entre novamente.',
      );
    }

    return usuarioId;
  },
);