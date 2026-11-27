-- Etapa 6: ficha sem data de nascimento pode ser aprovada. Nenhum dado é alterado.
ALTER TABLE "paciente" ALTER COLUMN "data_nascimento" DROP NOT NULL;
