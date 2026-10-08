ALTER TABLE "Agendamento" ADD COLUMN "adicionalCent" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ItemComanda" (
    "id" SERIAL NOT NULL,
    "agendamentoId" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 1,
    "valorUnitCent" INTEGER NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemComanda_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ItemComanda_agendamentoId_idx" ON "ItemComanda"("agendamentoId");
ALTER TABLE "ItemComanda" ADD CONSTRAINT "ItemComanda_agendamentoId_fkey"
  FOREIGN KEY ("agendamentoId") REFERENCES "Agendamento"("id") ON DELETE CASCADE ON UPDATE CASCADE;
