-- Autocontrole do kit: um resultado por método (LISS/Coombs, Enzima e Frio), como em resultado_celula
ALTER TABLE "kit_id"
  ADD COLUMN "autocontrole_liss_coombs" VARCHAR(5),
  ADD COLUMN "autocontrole_enzima" VARCHAR(5),
  ADD COLUMN "autocontrole_frio" VARCHAR(5);

-- O valor antigo era um só: vai para LISS/Coombs. "Negativo" vira "0"; texto longo demais não cabe.
UPDATE "kit_id"
SET "autocontrole_liss_coombs" = CASE
  WHEN "autocontrole" ILIKE 'neg%' THEN '0'
  WHEN length(trim("autocontrole")) <= 5 THEN trim("autocontrole")
END
WHERE "autocontrole" IS NOT NULL;

ALTER TABLE "kit_id" DROP COLUMN "autocontrole";
