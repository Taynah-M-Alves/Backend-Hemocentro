-- AlterTable
ALTER TABLE "ficha_digitalizada" ADD COLUMN "falhou_em" TIMESTAMP(3);

-- Fichas que já estão com erro: usa a data da última falha registrada na auditoria
UPDATE "ficha_digitalizada" f SET "falhou_em" = (
  SELECT MAX(e."ocorrido_em") FROM "evento_auditoria" e
  WHERE e."ficha_id" = f."id" AND e."tipo" = 'LEITURA_FALHOU'
) WHERE f."erro_leitura" IS NOT NULL;
