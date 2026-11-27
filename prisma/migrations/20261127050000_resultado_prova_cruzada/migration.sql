-- Etapa 9: prova cruzada passa a ser Compatível, Incompatível, Inconclusivo ou Não realizado.
-- Na ficha não existe positivo/negativo para prova cruzada (era o mesmo enum do PAI, então a IA
-- podia gravar esses valores). A pedido da Taynah (27/11/2026), eles viram NAO_REALIZADO.
-- Para guardar quais linhas mudam, rode antes:
--   SELECT id, numero_doacao, prova_cruzada FROM ficha_transfusional
--   WHERE prova_cruzada IN ('POSITIVO', 'NEGATIVO');
UPDATE "ficha_transfusional"
SET "prova_cruzada" = 'NAO_REALIZADO'
WHERE "prova_cruzada" IN ('POSITIVO', 'NEGATIVO');

CREATE TYPE "ResultadoProvaCruzada" AS ENUM ('NAO_REALIZADO', 'COMPATIVEL', 'INCOMPATIVEL', 'INCONCLUSIVO');

ALTER TABLE "ficha_transfusional"
  ALTER COLUMN "prova_cruzada" TYPE "ResultadoProvaCruzada"
  USING ("prova_cruzada"::text::"ResultadoProvaCruzada");
