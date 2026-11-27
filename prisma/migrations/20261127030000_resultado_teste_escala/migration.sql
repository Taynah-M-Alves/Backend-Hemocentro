-- Etapa 5: PAI, TAD e autocontrole em escala (Weak, 1+ a 4+).
-- POSITIVO continua para o que já foi gravado sem intensidade. Nenhum dado é alterado.
-- Os valores novos não são usados aqui: o Postgres não deixa usar um valor de enum
-- na mesma transação em que ele foi criado.
ALTER TYPE "ResultadoTeste" ADD VALUE IF NOT EXISTS 'POSITIVO_W' AFTER 'POSITIVO';
ALTER TYPE "ResultadoTeste" ADD VALUE IF NOT EXISTS 'POSITIVO_1' AFTER 'POSITIVO_W';
ALTER TYPE "ResultadoTeste" ADD VALUE IF NOT EXISTS 'POSITIVO_2' AFTER 'POSITIVO_1';
ALTER TYPE "ResultadoTeste" ADD VALUE IF NOT EXISTS 'POSITIVO_3' AFTER 'POSITIVO_2';
ALTER TYPE "ResultadoTeste" ADD VALUE IF NOT EXISTS 'POSITIVO_4' AFTER 'POSITIVO_3';
