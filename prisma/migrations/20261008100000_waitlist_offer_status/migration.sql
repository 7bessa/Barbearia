ALTER TABLE "ListaEspera" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'aguardando';
ALTER TABLE "ListaEspera" ADD COLUMN "vagaData" TEXT;
ALTER TABLE "ListaEspera" ADD COLUMN "vagaHora" TEXT;
