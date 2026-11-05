-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('GESTOR', 'COLABORADOR');

-- CreateEnum
CREATE TYPE "PermissaoUsuario" AS ENUM ('VISUALIZAR_DASHBOARD', 'ENVIAR_DOCUMENTOS', 'REVISAR_FICHAS', 'CONSULTAR_PRONTUARIOS', 'CONSULTAR_AUDITORIA');

-- CreateEnum
CREATE TYPE "FinalidadeTokenSenha" AS ENUM ('DEFINIR_SENHA', 'REDEFINIR_SENHA');

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "perfil" "PerfilUsuario" NOT NULL DEFAULT 'COLABORADOR',
ADD COLUMN     "permissoes" "PermissaoUsuario"[] DEFAULT ARRAY[]::"PermissaoUsuario"[],
ADD COLUMN     "senha_hash" TEXT;

-- CreateTable
CREATE TABLE "sessao_usuario" (
    "id" UUID NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "csrf_token" CHAR(64) NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "revogada_em" TIMESTAMP(3),

    CONSTRAINT "sessao_usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "token_senha" (
    "id" UUID NOT NULL,
    "usuario_id" INTEGER NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "finalidade" "FinalidadeTokenSenha" NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "usado_em" TIMESTAMP(3),

    CONSTRAINT "token_senha_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessao_usuario_token_hash_key" ON "sessao_usuario"("token_hash");

-- CreateIndex
CREATE INDEX "sessao_usuario_usuario_id_revogada_em_idx" ON "sessao_usuario"("usuario_id", "revogada_em");

-- CreateIndex
CREATE INDEX "sessao_usuario_expira_em_idx" ON "sessao_usuario"("expira_em");

-- CreateIndex
CREATE UNIQUE INDEX "token_senha_token_hash_key" ON "token_senha"("token_hash");

-- CreateIndex
CREATE INDEX "token_senha_usuario_id_idx" ON "token_senha"("usuario_id");

-- CreateIndex
CREATE INDEX "token_senha_expira_em_idx" ON "token_senha"("expira_em");

-- AddForeignKey
ALTER TABLE "sessao_usuario" ADD CONSTRAINT "sessao_usuario_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_senha" ADD CONSTRAINT "token_senha_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
