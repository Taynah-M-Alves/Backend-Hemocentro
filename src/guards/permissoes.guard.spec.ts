import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissaoUsuario } from '../generated/prisma/enums.js';
import { PermissoesGuard } from './permissoes.guard.js';

function contexto(perfil?: string, permissoes: string[] = []) {
  return {
    getHandler: () => function rotaTeste() {},
    getClass: () => class ControllerTeste {},
    switchToHttp: () => ({
      getRequest: () => ({
        sessaoAutenticada: perfil
          ? { usuario: { perfil, permissoes } }
          : undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

function criarGuard(permitidas?: PermissaoUsuario[]) {
  const reflector = {
    getAllAndOverride: () => permitidas,
  } as unknown as Reflector;

  return new PermissoesGuard(reflector);
}

describe('PermissoesGuard', () => {
  it('permite ao gestor mesmo sem permissões individuais', () => {
    const guard = criarGuard([PermissaoUsuario.REVISAR_FICHAS]);

    expect(guard.canActivate(contexto('GESTOR'))).toBe(true);
  });

  it('permite ao colaborador com a permissão exigida', () => {
    const guard = criarGuard([PermissaoUsuario.REVISAR_FICHAS]);

    expect(guard.canActivate(contexto('COLABORADOR', ['REVISAR_FICHAS']))).toBe(
      true,
    );
  });

  it('recusa colaborador com outra permissão', () => {
    const guard = criarGuard([PermissaoUsuario.REVISAR_FICHAS]);

    expect(() =>
      guard.canActivate(contexto('COLABORADOR', ['ENVIAR_DOCUMENTOS'])),
    ).toThrow(ForbiddenException);
  });

  it('aceita uma das alternativas permitidas', () => {
    const guard = criarGuard([
      PermissaoUsuario.REVISAR_FICHAS,
      PermissaoUsuario.CONSULTAR_PRONTUARIOS,
    ]);

    expect(
      guard.canActivate(contexto('COLABORADOR', ['CONSULTAR_PRONTUARIOS'])),
    ).toBe(true);
  });

  it('recusa ausência de sessão em rota com permissão declarada', () => {
    const guard = criarGuard([PermissaoUsuario.REVISAR_FICHAS]);

    expect(() => guard.canActivate(contexto())).toThrow(UnauthorizedException);
  });

  it('deixa a autenticação global cuidar de rotas sem regra adicional', () => {
    const guard = criarGuard();

    expect(guard.canActivate(contexto())).toBe(true);
  });
});
