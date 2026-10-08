ALTER TABLE "Despesa" ADD COLUMN "forma" "Forma" NOT NULL DEFAULT 'dinheiro';

CREATE TABLE "FechamentoCaixa" (
    "id" SERIAL NOT NULL,
    "barbeariaId" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "aberturaCent" INTEGER NOT NULL DEFAULT 0,
    "contadoDinheiroCent" INTEGER,
    "contadoPixCent" INTEGER,
    "contadoDebitoCent" INTEGER,
    "contadoCreditoCent" INTEGER,
    "observacao" TEXT NOT NULL DEFAULT '',
    "fechadoEm" TIMESTAMP(3),
    "fechadoPorId" INTEGER,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FechamentoCaixa_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FechamentoCaixa_barbeariaId_data_key" ON "FechamentoCaixa"("barbeariaId", "data");
CREATE INDEX "FechamentoCaixa_barbeariaId_data_idx" ON "FechamentoCaixa"("barbeariaId", "data");

ALTER TABLE "FechamentoCaixa" ADD CONSTRAINT "FechamentoCaixa_barbeariaId_fkey"
  FOREIGN KEY ("barbeariaId") REFERENCES "Barbearia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
