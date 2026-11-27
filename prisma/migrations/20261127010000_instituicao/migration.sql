-- Etapa 3: instituições de destino (hospitais e prontos-socorros, todas em Cuiabá/MT).
CREATE TABLE "instituicao" (
    "id" SERIAL NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "instituicao_pkey" PRIMARY KEY ("id")
);

-- Lista da Letícia (27/11/2026). Só insere o que ainda não existe (sem acento e sem maiúscula).
INSERT INTO "instituicao" ("nome")
SELECT v."nome"
FROM (VALUES
  ('Hospital Universitário Júlio Muller'),
  ('Hosp. São Benedito'),
  ('PS Cuiabá'),
  ('Hospital Municipal de Cuiabá (HMC)'),
  ('Poconé'),
  ('PS VG Várzea Grande'),
  ('Hosp. Metropolitano')
) AS v("nome")
WHERE NOT EXISTS (
  SELECT 1 FROM "instituicao" i
  WHERE unaccent(lower(trim(i."nome"))) = unaccent(lower(v."nome"))
);
