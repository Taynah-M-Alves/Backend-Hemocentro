-- Fluxo de revisão (Planejamento da API). Feita com as tabelas clínicas vazias: troca de enums
-- e de colunas (ex.: gs, dataPesquisa) não preserva linhas antigas.

-- CreateEnum
CREATE TYPE "Sexo" AS ENUM ('Feminino', 'Masculino');

-- CreateEnum
CREATE TYPE "GrupoAbo" AS ENUM ('A', 'B', 'AB', 'O');

-- CreateEnum
CREATE TYPE "TipoKitId" AS ENUM ('DIACELL', 'DIAPANEL');

-- CreateEnum
CREATE TYPE "StatusFicha" AS ENUM ('ENVIADA', 'LENDO', 'FALHA_LEITURA', 'AGUARDANDO_REVISAO', 'EM_REVISAO', 'COM_PENDENCIA', 'VALIDADA');

-- CreateEnum
CREATE TYPE "TipoEvento" AS ENUM ('LOTE_ENVIADO', 'LEITURA_CONCLUIDA', 'LEITURA_FALHOU', 'REPROCESSAMENTO', 'REVISAO_INICIADA', 'REVISAO_ASSUMIDA', 'CAMPO_EDITADO', 'PENDENCIA_SINALIZADA', 'FICHA_VALIDADA', 'VINCULO_CONFIRMADO', 'CONSULTA');

-- AlterEnum
BEGIN;
CREATE TYPE "ResultadoTeste_new" AS ENUM ('NAO_REALIZADO', 'POSITIVO', 'NEGATIVO');
ALTER TABLE "ficha_transfusional" ALTER COLUMN "testes_pai" TYPE "ResultadoTeste_new" USING ("testes_pai"::text::"ResultadoTeste_new");
ALTER TABLE "ficha_transfusional" ALTER COLUMN "prova_cruzada" TYPE "ResultadoTeste_new" USING ("prova_cruzada"::text::"ResultadoTeste_new");
ALTER TYPE "ResultadoTeste" RENAME TO "ResultadoTeste_old";
ALTER TYPE "ResultadoTeste_new" RENAME TO "ResultadoTeste";
DROP TYPE "public"."ResultadoTeste_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "Rh_new" AS ENUM ('POSITIVO', 'NEGATIVO', 'NAO_DETERMINADO');
ALTER TABLE "pesquisa_anticorpos" ALTER COLUMN "rh" TYPE "Rh_new" USING ("rh"::text::"Rh_new");
ALTER TYPE "Rh" RENAME TO "Rh_old";
ALTER TYPE "Rh_new" RENAME TO "Rh";
DROP TYPE "public"."Rh_old";
COMMIT;

-- AlterTable
ALTER TABLE "ficha_transfusional" ADD COLUMN     "ficha_digitalizada_id" INTEGER,
ADD COLUMN     "numero_servico" VARCHAR(30),
ADD COLUMN     "pagina" INTEGER,
ADD COLUMN     "tracejador" VARCHAR(50);

-- AlterTable
ALTER TABLE "paciente" ADD COLUMN     "alergias" VARCHAR(255),
ADD COLUMN     "cartao_sus" VARCHAR(15),
ADD COLUMN     "cpf" VARCHAR(11),
ADD COLUMN     "nome_pai" VARCHAR(255),
ADD COLUMN     "nome_social" VARCHAR(255),
ADD COLUMN     "sexo" "Sexo",
ALTER COLUMN "raca_cor" DROP NOT NULL,
ALTER COLUMN "abo_rh" DROP NOT NULL;

-- AlterTable
ALTER TABLE "pesquisa_anticorpos" DROP COLUMN "dataPesquisa",
ADD COLUMN     "amostra" VARCHAR(50),
ADD COLUMN     "d_fraco" VARCHAR(50),
ADD COLUMN     "data_pesquisa" DATE NOT NULL,
ADD COLUMN     "dc_screening" VARCHAR(50),
ADD COLUMN     "especificidade" VARCHAR(255),
ADD COLUMN     "ficha_digitalizada_id" INTEGER,
ADD COLUMN     "metodologia" VARCHAR(100),
ADD COLUMN     "observacao" VARCHAR(255),
ADD COLUMN     "pagina" INTEGER,
DROP COLUMN "gs",
ADD COLUMN     "gs" "GrupoAbo",
ALTER COLUMN "rh" DROP NOT NULL;

-- CreateTable
CREATE TABLE "fenotipagem_antigeno" (
    "id" SERIAL NOT NULL,
    "pesquisa_id" INTEGER NOT NULL,
    "antigeno" VARCHAR(10) NOT NULL,
    "resultado" VARCHAR(5) NOT NULL,

    CONSTRAINT "fenotipagem_antigeno_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kit_id" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoKitId" NOT NULL,
    "data_pesquisa" DATE NOT NULL,
    "gs" "GrupoAbo",
    "rh" "Rh",
    "tad" VARCHAR(50),
    "pai" VARCHAR(50),
    "autocontrole" VARCHAR(50),
    "interpretacao" VARCHAR(255),
    "tecnica" VARCHAR(100),
    "observacao" VARCHAR(255),
    "paciente_id" UUID NOT NULL,
    "ficha_digitalizada_id" INTEGER,
    "pagina" INTEGER,

    CONSTRAINT "kit_id_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resultado_celula" (
    "id" SERIAL NOT NULL,
    "kit_id" INTEGER NOT NULL,
    "celula" INTEGER NOT NULL,
    "liss_coombs" VARCHAR(5),
    "enzima" VARCHAR(5),

    CONSTRAINT "resultado_celula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "colaborador_id" INTEGER,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lote" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "enviado_por_id" INTEGER NOT NULL,
    "enviado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documento" (
    "id" SERIAL NOT NULL,
    "lote_id" INTEGER NOT NULL,
    "chave" VARCHAR(100) NOT NULL,
    "nome_original" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(50) NOT NULL,
    "tamanho_bytes" INTEGER NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "total_paginas" INTEGER,
    "provedor_ia" VARCHAR(20),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ficha_digitalizada" (
    "id" SERIAL NOT NULL,
    "documento_id" INTEGER NOT NULL,
    "status" "StatusFicha" NOT NULL DEFAULT 'ENVIADA',
    "erro_leitura" TEXT,
    "tentativas_leitura" INTEGER NOT NULL DEFAULT 0,
    "proxima_tentativa_em" TIMESTAMP(3),
    "data_atendimento" DATE,
    "motivo" VARCHAR(255),
    "dados_extraidos" JSONB,
    "paciente_id" UUID,
    "paciente_sugerido_id" UUID,
    "revisor_id" INTEGER,
    "revisao_iniciada_em" TIMESTAMP(3),
    "validado_por_id" INTEGER,
    "validado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ficha_digitalizada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evento_auditoria" (
    "id" SERIAL NOT NULL,
    "tipo" "TipoEvento" NOT NULL,
    "ocorrido_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuario_id" INTEGER,
    "lote_id" INTEGER,
    "documento_id" INTEGER,
    "ficha_id" INTEGER,
    "paciente_id" UUID,
    "campo" VARCHAR(100),
    "pagina" INTEGER,
    "valor_anterior" TEXT,
    "valor_posterior" TEXT,
    "justificativa" TEXT,

    CONSTRAINT "evento_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fenotipagem_antigeno_pesquisa_id_antigeno_key" ON "fenotipagem_antigeno"("pesquisa_id", "antigeno");

-- CreateIndex
CREATE UNIQUE INDEX "resultado_celula_kit_id_celula_key" ON "resultado_celula"("kit_id", "celula");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_colaborador_id_key" ON "usuario"("colaborador_id");

-- CreateIndex
CREATE UNIQUE INDEX "documento_chave_key" ON "documento"("chave");

-- CreateIndex
CREATE INDEX "documento_lote_id_idx" ON "documento"("lote_id");

-- CreateIndex
CREATE INDEX "documento_sha256_idx" ON "documento"("sha256");

-- CreateIndex
CREATE UNIQUE INDEX "ficha_digitalizada_documento_id_key" ON "ficha_digitalizada"("documento_id");

-- CreateIndex
CREATE INDEX "ficha_digitalizada_status_idx" ON "ficha_digitalizada"("status");

-- CreateIndex
CREATE INDEX "ficha_digitalizada_paciente_id_idx" ON "ficha_digitalizada"("paciente_id");

-- CreateIndex
CREATE INDEX "evento_auditoria_ficha_id_idx" ON "evento_auditoria"("ficha_id");

-- CreateIndex
CREATE INDEX "evento_auditoria_paciente_id_idx" ON "evento_auditoria"("paciente_id");

-- CreateIndex
CREATE INDEX "evento_auditoria_ocorrido_em_idx" ON "evento_auditoria"("ocorrido_em");

-- CreateIndex
CREATE UNIQUE INDEX "cidade_nome_cidade_uf_key" ON "cidade"("nome_cidade", "uf");

-- CreateIndex
CREATE UNIQUE INDEX "paciente_cpf_key" ON "paciente"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX "paciente_cartao_sus_key" ON "paciente"("cartao_sus");

-- CreateIndex
CREATE INDEX "paciente_nome_data_nascimento_idx" ON "paciente"("nome", "data_nascimento");

-- CreateIndex
CREATE INDEX "paciente_nome_mae_idx" ON "paciente"("nome_mae");

-- AddForeignKey
ALTER TABLE "ficha_transfusional" ADD CONSTRAINT "ficha_transfusional_ficha_digitalizada_id_fkey" FOREIGN KEY ("ficha_digitalizada_id") REFERENCES "ficha_digitalizada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesquisa_anticorpos" ADD CONSTRAINT "pesquisa_anticorpos_ficha_digitalizada_id_fkey" FOREIGN KEY ("ficha_digitalizada_id") REFERENCES "ficha_digitalizada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fenotipagem_antigeno" ADD CONSTRAINT "fenotipagem_antigeno_pesquisa_id_fkey" FOREIGN KEY ("pesquisa_id") REFERENCES "pesquisa_anticorpos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_id" ADD CONSTRAINT "kit_id_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kit_id" ADD CONSTRAINT "kit_id_ficha_digitalizada_id_fkey" FOREIGN KEY ("ficha_digitalizada_id") REFERENCES "ficha_digitalizada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resultado_celula" ADD CONSTRAINT "resultado_celula_kit_id_fkey" FOREIGN KEY ("kit_id") REFERENCES "kit_id"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_colaborador_id_fkey" FOREIGN KEY ("colaborador_id") REFERENCES "colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lote" ADD CONSTRAINT "lote_enviado_por_id_fkey" FOREIGN KEY ("enviado_por_id") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documento" ADD CONSTRAINT "documento_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ficha_digitalizada" ADD CONSTRAINT "ficha_digitalizada_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ficha_digitalizada" ADD CONSTRAINT "ficha_digitalizada_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ficha_digitalizada" ADD CONSTRAINT "ficha_digitalizada_paciente_sugerido_id_fkey" FOREIGN KEY ("paciente_sugerido_id") REFERENCES "paciente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ficha_digitalizada" ADD CONSTRAINT "ficha_digitalizada_revisor_id_fkey" FOREIGN KEY ("revisor_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ficha_digitalizada" ADD CONSTRAINT "ficha_digitalizada_validado_por_id_fkey" FOREIGN KEY ("validado_por_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_auditoria" ADD CONSTRAINT "evento_auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_auditoria" ADD CONSTRAINT "evento_auditoria_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "lote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_auditoria" ADD CONSTRAINT "evento_auditoria_documento_id_fkey" FOREIGN KEY ("documento_id") REFERENCES "documento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_auditoria" ADD CONSTRAINT "evento_auditoria_ficha_id_fkey" FOREIGN KEY ("ficha_id") REFERENCES "ficha_digitalizada"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evento_auditoria" ADD CONSTRAINT "evento_auditoria_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

