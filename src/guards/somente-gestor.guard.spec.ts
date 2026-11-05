import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { SomenteGestorGuard } from './somente-gestor.guard.js';

function contextoComUsuario(usuario?: {
  perfil: string;
  permissoes?: string[];
}): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        sessaoAutenticada: usuario ? { usuario } : undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('SomenteGestorGuard', () => {
  const guard = new SomenteGestorGuard();

  it('permite acesso ao gestor', () => {
    const contexto = contextoComUsuario({
      perfil: 'GESTOR',
      permissoes: [],
    });

    expect(guard.canActivate(contexto)).toBe(true);
  });

  it('recusa colaborador mesmo com permissões operacionais', () => {
    const contexto = contextoComUsuario({
      perfil: 'COLABORADOR',
      permissoes: [
        'VISUALIZAR_DASHBOARD',
        'ENVIAR_DOCUMENTOS',
        'REVISAR_FICHAS',
        'CONSULTAR_PRONTUARIOS',
        'CONSULTAR_AUDITORIA',
      ],
    });

    expect(() => guard.canActivate(contexto)).toThrow(ForbiddenException);
  });

  it('recusa acesso sem usuário autenticado', () => {
    expect(() => guard.canActivate(contextoComUsuario())).toThrow(
      UnauthorizedException,
    );
  });
});
