-- Etapa 1: colaborador pode ser inativado (some do select, continua nas fichas antigas).
ALTER TABLE "colaborador" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;

-- Lista da Letícia (27/11/2026). Só insere quem ainda não existe (sem acento e sem maiúscula),
-- então rodar de novo ou ter alguém já cadastrado não duplica nem apaga nada.
INSERT INTO "colaborador" ("nome")
SELECT v."nome"
FROM (VALUES
  ('Weslley André Silva'),
  ('Leticia B. S. Heinen Braun'),
  ('Joelma Pessoa Gonçalves'),
  ('Emanuel Aparecido da Silva'),
  ('Raphael Rondon Rudolf'),
  ('Romulo F. Benevides'),
  ('Evanir Juliana Ferreira'),
  ('Lúcia Gomes da Silva'),
  ('Marlene Gonzaga de Arruda Metelo')
) AS v("nome")
WHERE NOT EXISTS (
  SELECT 1 FROM "colaborador" c
  WHERE unaccent(lower(trim(c."nome"))) = unaccent(lower(v."nome"))
);
