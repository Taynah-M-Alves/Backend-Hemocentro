-- PAI, TAD, autocontrole e DC-Screening da pesquisa: só POSITIVO, NEGATIVO ou NAO_REALIZADO.
-- Texto antigo é convertido como no sanitize; o que não se encaixa vira NULL.
CREATE FUNCTION pg_temp.resultado_teste(v TEXT) RETURNS "ResultadoTeste" AS $$
  SELECT CASE
    WHEN upper(trim(v)) LIKE 'POS%' THEN 'POSITIVO'
    WHEN upper(trim(v)) LIKE 'NEG%' THEN 'NEGATIVO'
    WHEN upper(trim(v)) = 'NR' OR upper(trim(v)) ~ '^N[AÃ]O.?REALIZ' THEN 'NAO_REALIZADO'
  END::"ResultadoTeste"
$$ LANGUAGE SQL;

ALTER TABLE "pesquisa_anticorpos"
  ALTER COLUMN "pai" TYPE "ResultadoTeste" USING pg_temp.resultado_teste("pai"),
  ALTER COLUMN "tad" TYPE "ResultadoTeste" USING pg_temp.resultado_teste("tad"),
  ALTER COLUMN "autocontrole" TYPE "ResultadoTeste" USING pg_temp.resultado_teste("autocontrole"),
  ALTER COLUMN "dc_screening" TYPE "ResultadoTeste" USING pg_temp.resultado_teste("dc_screening");
