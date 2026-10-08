ALTER TABLE "Barbearia" ADD COLUMN "capacidadeCadeiras" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Agendamento" ADD COLUMN "cadeira" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "Agendamento_barbeariaId_data_cadeira_idx" ON "Agendamento"("barbeariaId", "data", "cadeira");
