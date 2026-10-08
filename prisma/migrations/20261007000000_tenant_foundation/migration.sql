CREATE TABLE "Barbearia" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "slogan" TEXT NOT NULL DEFAULT '',
    "logo" TEXT NOT NULL DEFAULT '/logo.svg',
    "corPrimaria" TEXT NOT NULL DEFAULT '#fbbf24',
    "corFundo" TEXT NOT NULL DEFAULT '#09090b',
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Barbearia_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Barbearia" ("id", "nome", "slug", "slogan", "logo", "corPrimaria", "corFundo")
VALUES (1, 'Barbearia Exemplo', 'barbearia-exemplo', 'Estilo e tradição', '/logo.svg', '#fbbf24', '#09090b');
SELECT setval(pg_get_serial_sequence('"Barbearia"', 'id'), 1, true);

ALTER TABLE "Usuario" ADD COLUMN "barbeariaId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Barbeiro" ADD COLUMN "barbeariaId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Servico" ADD COLUMN "barbeariaId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Horario" ADD COLUMN "barbeariaId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Bloqueio" ADD COLUMN "barbeariaId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Nota" ADD COLUMN "barbeariaId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Agendamento" ADD COLUMN "barbeariaId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Convite" ADD COLUMN "barbeariaId" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Auditoria" ADD COLUMN "barbeariaId" INTEGER;
UPDATE "Auditoria" SET "barbeariaId" = 1 WHERE "userId" IS NOT NULL;

ALTER TABLE "Usuario" ALTER COLUMN "barbeariaId" DROP DEFAULT;
ALTER TABLE "Barbeiro" ALTER COLUMN "barbeariaId" DROP DEFAULT;
ALTER TABLE "Servico" ALTER COLUMN "barbeariaId" DROP DEFAULT;
ALTER TABLE "Horario" ALTER COLUMN "barbeariaId" DROP DEFAULT;
ALTER TABLE "Bloqueio" ALTER COLUMN "barbeariaId" DROP DEFAULT;
ALTER TABLE "Nota" ALTER COLUMN "barbeariaId" DROP DEFAULT;
ALTER TABLE "Agendamento" ALTER COLUMN "barbeariaId" DROP DEFAULT;
ALTER TABLE "Convite" ALTER COLUMN "barbeariaId" DROP DEFAULT;

DROP INDEX "Usuario_telefone_key";
CREATE UNIQUE INDEX "Usuario_barbeariaId_telefone_key" ON "Usuario"("barbeariaId", "telefone");
CREATE UNIQUE INDEX "Barbearia_slug_key" ON "Barbearia"("slug");
CREATE UNIQUE INDEX "Horario_barbeariaId_key" ON "Horario"("barbeariaId");
CREATE INDEX "Usuario_barbeariaId_idx" ON "Usuario"("barbeariaId");
CREATE INDEX "Barbeiro_barbeariaId_idx" ON "Barbeiro"("barbeariaId");
CREATE INDEX "Servico_barbeariaId_idx" ON "Servico"("barbeariaId");
CREATE INDEX "Bloqueio_barbeariaId_barberId_data_idx" ON "Bloqueio"("barbeariaId", "barberId", "data");
CREATE INDEX "Nota_barbeariaId_clienteId_idx" ON "Nota"("barbeariaId", "clienteId");
CREATE INDEX "Agendamento_barbeariaId_data_idx" ON "Agendamento"("barbeariaId", "data");
CREATE INDEX "Agendamento_barbeariaId_barberId_data_idx" ON "Agendamento"("barbeariaId", "barberId", "data");
CREATE INDEX "Convite_barbeariaId_idx" ON "Convite"("barbeariaId");
CREATE INDEX "Auditoria_barbeariaId_ts_idx" ON "Auditoria"("barbeariaId", "ts");

ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_barbeariaId_fkey"
  FOREIGN KEY ("barbeariaId") REFERENCES "Barbearia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Barbeiro" ADD CONSTRAINT "Barbeiro_barbeariaId_fkey"
  FOREIGN KEY ("barbeariaId") REFERENCES "Barbearia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Servico" ADD CONSTRAINT "Servico_barbeariaId_fkey"
  FOREIGN KEY ("barbeariaId") REFERENCES "Barbearia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Horario" ADD CONSTRAINT "Horario_barbeariaId_fkey"
  FOREIGN KEY ("barbeariaId") REFERENCES "Barbearia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Bloqueio" ADD CONSTRAINT "Bloqueio_barbeariaId_fkey"
  FOREIGN KEY ("barbeariaId") REFERENCES "Barbearia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Nota" ADD CONSTRAINT "Nota_barbeariaId_fkey"
  FOREIGN KEY ("barbeariaId") REFERENCES "Barbearia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_barbeariaId_fkey"
  FOREIGN KEY ("barbeariaId") REFERENCES "Barbearia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Convite" ADD CONSTRAINT "Convite_barbeariaId_fkey"
  FOREIGN KEY ("barbeariaId") REFERENCES "Barbearia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Auditoria" ADD CONSTRAINT "Auditoria_barbeariaId_fkey"
  FOREIGN KEY ("barbeariaId") REFERENCES "Barbearia"("id") ON DELETE SET NULL ON UPDATE CASCADE;
