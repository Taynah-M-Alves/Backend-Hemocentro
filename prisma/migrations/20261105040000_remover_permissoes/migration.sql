-- Só perfis: GESTOR (tudo) e COLABORADOR (tudo menos criar/inativar/reativar usuário).
-- O enum PerfilUsuario já tem apenas esses dois valores, então não há perfil para converter.
ALTER TABLE "usuario" DROP COLUMN "permissoes";
DROP TYPE "PermissaoUsuario";
