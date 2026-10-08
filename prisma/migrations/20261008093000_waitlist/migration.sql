CREATE TABLE "ListaEspera" (
  "id" SERIAL NOT NULL,
  "barbeariaId" INTEGER NOT NULL,
  "clienteNome" TEXT NOT NULL,
  "clienteTel" TEXT NOT NULL,
  "servicoId" INTEGER,
  "barberId" INTEGER,
  "data" TEXT,
  "preferencia" TEXT NOT NULL DEFAULT '',
  "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ListaEspera_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ListaEspera_barbeariaId_data_idx" ON "ListaEspera"("barbeariaId", "data");
CREATE INDEX "ListaEspera_barbeariaId_barberId_idx" ON "ListaEspera"("barbeariaId", "barberId");
ALTER TABLE "ListaEspera" ADD CONSTRAINT "ListaEspera_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "Barbearia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
