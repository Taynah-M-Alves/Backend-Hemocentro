-- CreateEnum
CREATE TYPE "ResultadoTeste" AS ENUM ('NR', 'POSITIVO', 'NEGATIVO');

-- CreateEnum
CREATE TYPE "Raca" AS ENUM ('Branco', 'Preto', 'Pardo', 'Amarelo', 'Indígena');

-- CreateEnum
CREATE TYPE "Abo" AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');

-- CreateEnum
CREATE TYPE "Rh" AS ENUM ('Positivo', 'Negativo', 'Nao_Determinado');

-- CreateTable
CREATE TABLE "paciente" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "raca_cor" "Raca" NOT NULL,
    "abo_rh" "Abo" NOT NULL,
    "data_nascimento" DATE NOT NULL,
    "prontuario" INTEGER,
    "diagnostico" VARCHAR(255),
    "nome_mae" VARCHAR(255),
    "municipio_paciente_id" INTEGER,

    CONSTRAINT "paciente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cidade" (
    "id" SERIAL NOT NULL,
    "nome_cidade" VARCHAR(120) NOT NULL,
    "uf" VARCHAR(2) NOT NULL,

    CONSTRAINT "cidade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "colaborador" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(255) NOT NULL,

    CONSTRAINT "colaborador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ficha_transfusional" (
    "id" SERIAL NOT NULL,
    "data_envio" DATE NOT NULL,
    "tipo_hemocomponente" VARCHAR(100) NOT NULL,
    "numero_doacao" VARCHAR(30) NOT NULL,
    "grs_rhd" "Abo" NOT NULL,
    "vol_ml" INTEGER NOT NULL,
    "testes_pai" "ResultadoTeste" NOT NULL,
    "prova_cruzada" "ResultadoTeste" NOT NULL,
    "paciente_id" UUID NOT NULL,
    "cidade_destino_id" INTEGER,
    "responsavel_liberacao_id" INTEGER,

    CONSTRAINT "ficha_transfusional_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pesquisa_anticorpos" (
    "id" SERIAL NOT NULL,
    "gs" "Abo" NOT NULL,
    "rh" "Rh" NOT NULL,
    "tad" VARCHAR(50),
    "pai" VARCHAR(50),
    "autocontrole" VARCHAR(50),
    "interpretacao" VARCHAR(255),
    "dataPesquisa" DATE NOT NULL,
    "paciente_id" UUID NOT NULL,
    "responsavel_pesquisa_id" INTEGER,

    CONSTRAINT "pesquisa_anticorpos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "paciente_prontuario_key" ON "paciente"("prontuario");

-- CreateIndex
CREATE UNIQUE INDEX "ficha_transfusional_numero_doacao_key" ON "ficha_transfusional"("numero_doacao");

-- AddForeignKey
ALTER TABLE "paciente" ADD CONSTRAINT "paciente_municipio_paciente_id_fkey" FOREIGN KEY ("municipio_paciente_id") REFERENCES "cidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ficha_transfusional" ADD CONSTRAINT "ficha_transfusional_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ficha_transfusional" ADD CONSTRAINT "ficha_transfusional_cidade_destino_id_fkey" FOREIGN KEY ("cidade_destino_id") REFERENCES "cidade"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ficha_transfusional" ADD CONSTRAINT "ficha_transfusional_responsavel_liberacao_id_fkey" FOREIGN KEY ("responsavel_liberacao_id") REFERENCES "colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesquisa_anticorpos" ADD CONSTRAINT "pesquisa_anticorpos_paciente_id_fkey" FOREIGN KEY ("paciente_id") REFERENCES "paciente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pesquisa_anticorpos" ADD CONSTRAINT "pesquisa_anticorpos_responsavel_pesquisa_id_fkey" FOREIGN KEY ("responsavel_pesquisa_id") REFERENCES "colaborador"("id") ON DELETE SET NULL ON UPDATE CASCADE;
