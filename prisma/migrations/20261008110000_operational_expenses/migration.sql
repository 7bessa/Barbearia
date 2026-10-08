CREATE TABLE "Despesa" (
    "id" SERIAL NOT NULL,
    "barbeariaId" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valorCent" INTEGER NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Despesa_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Despesa_barbeariaId_data_idx" ON "Despesa"("barbeariaId", "data");

ALTER TABLE "Despesa" ADD CONSTRAINT "Despesa_barbeariaId_fkey"
  FOREIGN KEY ("barbeariaId") REFERENCES "Barbearia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
