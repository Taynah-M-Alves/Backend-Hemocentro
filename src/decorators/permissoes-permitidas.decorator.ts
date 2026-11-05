import { SetMetadata } from '@nestjs/common';
import type { PermissaoUsuario } from '../generated/prisma/enums.js';

export const PERMISSOES_PERMITIDAS = 'autenticacao:permissoes-permitidas';

/** Exige que o usuário possua pelo menos uma das permissões informadas. */
export const PermissoesPermitidas = (...permissoes: PermissaoUsuario[]) =>
  SetMetadata(PERMISSOES_PERMITIDAS, permissoes);