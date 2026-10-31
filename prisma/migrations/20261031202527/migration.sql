/*
  Warnings:

  - You are about to drop the column `uf` on the `cidade` table. All the data in the column will be lost.
  - Added the required column `code` to the `cidade` table without a default value. This is not possible if the table is not empty.
  - Added the required column `estado_id` to the `cidade` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "cidade_nome_cidade_uf_key";

-- AlterTable
ALTER TABLE "cidade" DROP COLUMN "uf",
ADD COLUMN     "code" INTEGER NOT NULL,
ADD COLUMN     "estado_id" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "estados" (
    "id" SERIAL NOT NULL,
    "uf_code" INTEGER NOT NULL,
    "estado_nome" VARCHAR(50) NOT NULL,
    "uf" CHAR(2) NOT NULL,

    CONSTRAINT "estados_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "cidade" ADD CONSTRAINT "fk_cidade_estado" FOREIGN KEY ("estado_id") REFERENCES "estados"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
