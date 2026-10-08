ALTER TABLE "ItemComanda" ADD COLUMN "produtoId" INTEGER;

CREATE TABLE "Produto" (
    "id" SERIAL NOT NULL,
    "barbeariaId" INTEGER NOT NULL,
    "nome" TEXT NOT NULL,
    "precoCent" INTEGER NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 0,
    "estoqueMinimo" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MovimentoEstoque" (
    "id" SERIAL NOT NULL,
    "barbeariaId" INTEGER NOT NULL,
    "produtoId" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MovimentoEstoque_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Produto_barbeariaId_ativo_idx" ON "Produto"("barbeariaId", "ativo");
CREATE INDEX "MovimentoEstoque_barbeariaId_produtoId_criadaEm_idx" ON "MovimentoEstoque"("barbeariaId", "produtoId", "criadaEm");
ALTER TABLE "ItemComanda" ADD CONSTRAINT "ItemComanda_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "Barbearia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_barbeariaId_fkey" FOREIGN KEY ("barbeariaId") REFERENCES "Barbearia"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
