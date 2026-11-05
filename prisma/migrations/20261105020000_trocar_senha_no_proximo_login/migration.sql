-- Quem já tem conta não é obrigado a trocar; usuários novos recebem true no cadastro
ALTER TABLE "usuario" ADD COLUMN "trocar_senha_no_proximo_login" BOOLEAN NOT NULL DEFAULT false;
