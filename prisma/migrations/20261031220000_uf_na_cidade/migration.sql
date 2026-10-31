-- Devolve a coluna uf da cidade (apagada pela 20261031202527), preenchida pela tabela estados
ALTER TABLE "cidade" ADD COLUMN "uf" CHAR(2);

UPDATE "cidade" c SET "uf" = e."uf" FROM "estados" e WHERE e."id" = c."estado_id";

CREATE UNIQUE INDEX "cidade_nome_cidade_uf_key" ON "cidade"("nome_cidade", "uf");
