-- Etapa 4: o destino da transfusão pode ser uma instituição em vez de uma cidade.
-- Coluna opcional: as transfusões já gravadas ficam com NULL.
ALTER TABLE "ficha_transfusional" ADD COLUMN "instituicao_destino_id" INTEGER;

ALTER TABLE "ficha_transfusional" ADD CONSTRAINT "ficha_transfusional_instituicao_destino_id_fkey" FOREIGN KEY ("instituicao_destino_id") REFERENCES "instituicao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
