-- Anticorpos identificados na pesquisa: um por linha, com data e classe (IgG/IgM).
CREATE TYPE "ClasseAnticorpo" AS ENUM ('IGG', 'IGM');

CREATE TABLE "anticorpo_identificado" (
    "id" SERIAL NOT NULL,
    "pesquisa_id" INTEGER NOT NULL,
    "especificidade" VARCHAR(50) NOT NULL,
    "data" DATE,
    "classe" "ClasseAnticorpo",

    CONSTRAINT "anticorpo_identificado_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "anticorpo_identificado" ADD CONSTRAINT "anticorpo_identificado_pesquisa_id_fkey" FOREIGN KEY ("pesquisa_id") REFERENCES "pesquisa_anticorpos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- O texto antigo ("Anti-E, Anti-K") vira uma linha por anticorpo, separado como no sanitize.
-- Data e classe não existiam antes: ficam vazias.
INSERT INTO "anticorpo_identificado" ("pesquisa_id", "especificidade")
SELECT p."id", left(trim(a.nome), 50)
FROM "pesquisa_anticorpos" p,
     regexp_split_to_table(p."especificidade", '\s*[,;/+]\s*|\s+e\s+', 'i') WITH ORDINALITY AS a(nome, ordem)
WHERE trim(a.nome) <> ''
ORDER BY p."id", a.ordem;
