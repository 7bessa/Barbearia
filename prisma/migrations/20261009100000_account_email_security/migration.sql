ALTER TABLE "Usuario"
ADD COLUMN "emailVerificado" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "TokenConta" (
  "id" SERIAL NOT NULL,
  "hash" TEXT NOT NULL,
  "usuarioId" INTEGER NOT NULL,
  "tipo" TEXT NOT NULL,
  "expiraEm" TIMESTAMP(3) NOT NULL,
  "consumidoEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TokenConta_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TokenConta_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TokenConta_hash_key" ON "TokenConta"("hash");
CREATE INDEX "TokenConta_usuarioId_tipo_idx" ON "TokenConta"("usuarioId", "tipo");
CREATE INDEX "TokenConta_expiraEm_idx" ON "TokenConta"("expiraEm");
