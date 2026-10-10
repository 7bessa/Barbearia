CREATE TABLE "Assinatura" (
    "id" SERIAL NOT NULL,
    "barbeariaId" INTEGER NOT NULL,
    "gatewayId" TEXT NOT NULL,
    "gatewayPlanoId" TEXT NOT NULL,
    "plano" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "checkoutUrl" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadaEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assinatura_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Assinatura_gatewayId_key" ON "Assinatura"("gatewayId");
CREATE INDEX "Assinatura_barbeariaId_criadaEm_idx" ON "Assinatura"("barbeariaId", "criadaEm");
CREATE INDEX "Assinatura_barbeariaId_status_idx" ON "Assinatura"("barbeariaId", "status");

ALTER TABLE "Assinatura"
ADD CONSTRAINT "Assinatura_barbeariaId_fkey"
FOREIGN KEY ("barbeariaId") REFERENCES "Barbearia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
