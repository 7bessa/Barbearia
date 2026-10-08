-- CreateEnum
CREATE TYPE "Role" AS ENUM ('cliente', 'barbeiro', 'admin');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('agendado', 'concluido', 'faltou', 'cancelado');

-- CreateEnum
CREATE TYPE "Forma" AS ENUM ('dinheiro', 'pix', 'debito', 'credito');

-- CreateTable
CREATE TABLE "Usuario" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "email" TEXT,
    "telefone" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "senhaHash" TEXT NOT NULL,
    "semConta" BOOLEAN NOT NULL DEFAULT false,
    "criadoPorId" INTEGER,
    "barberId" INTEGER,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Barbeiro" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "comissao" INTEGER NOT NULL,

    CONSTRAINT "Barbeiro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Servico" (
    "id" SERIAL NOT NULL,
    "nome" TEXT NOT NULL,
    "precoCent" INTEGER NOT NULL,
    "dur" INTEGER NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Servico_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Horario" (
    "id" INTEGER NOT NULL,
    "abre" TEXT NOT NULL,
    "fecha" TEXT NOT NULL,
    "almocoIni" TEXT,
    "almocoFim" TEXT,
    "dias" INTEGER[],

    CONSTRAINT "Horario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bloqueio" (
    "id" SERIAL NOT NULL,
    "barberId" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "ini" TEXT NOT NULL,
    "fim" TEXT NOT NULL,
    "motivo" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Bloqueio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Nota" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER NOT NULL,
    "autorId" INTEGER,
    "autorNome" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Nota_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agendamento" (
    "id" SERIAL NOT NULL,
    "clienteId" INTEGER,
    "clienteNome" TEXT NOT NULL,
    "clienteTel" TEXT NOT NULL,
    "barberId" INTEGER NOT NULL,
    "servicoId" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "hora" TEXT NOT NULL,
    "dur" INTEGER NOT NULL,
    "precoCent" INTEGER NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'agendado',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "forma" "Forma",
    "comissaoPct" INTEGER,
    "pagoEm" TIMESTAMP(3),

    CONSTRAINT "Agendamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sessao" (
    "sid" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "refreshHash" TEXT NOT NULL,
    "exp" TIMESTAMP(3) NOT NULL,
    "indevidas" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Sessao_pkey" PRIMARY KEY ("sid")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "chave" TEXT NOT NULL,
    "n" INTEGER NOT NULL,
    "ini" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("chave")
);

-- CreateTable
CREATE TABLE "Convite" (
    "hash" TEXT NOT NULL,
    "criadoPorId" INTEGER NOT NULL,
    "expira" TIMESTAMP(3) NOT NULL,
    "usadoPorId" INTEGER,

    CONSTRAINT "Convite_pkey" PRIMARY KEY ("hash")
);

-- CreateTable
CREATE TABLE "Auditoria" (
    "id" SERIAL NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip" TEXT,
    "ua" TEXT,
    "acao" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "userId" INTEGER,
    "detalhe" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_telefone_key" ON "Usuario"("telefone");

-- CreateIndex
CREATE INDEX "Bloqueio_barberId_data_idx" ON "Bloqueio"("barberId", "data");

-- CreateIndex
CREATE INDEX "Nota_clienteId_idx" ON "Nota"("clienteId");

-- CreateIndex
CREATE INDEX "Agendamento_barberId_data_idx" ON "Agendamento"("barberId", "data");

-- CreateIndex
CREATE INDEX "Agendamento_clienteId_idx" ON "Agendamento"("clienteId");

-- CreateIndex
CREATE INDEX "Agendamento_data_idx" ON "Agendamento"("data");

-- CreateIndex
CREATE INDEX "Sessao_userId_idx" ON "Sessao"("userId");

-- CreateIndex
CREATE INDEX "Auditoria_ts_idx" ON "Auditoria"("ts");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_criadoPorId_fkey" FOREIGN KEY ("criadoPorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barbeiro"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bloqueio" ADD CONSTRAINT "Bloqueio_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barbeiro"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nota" ADD CONSTRAINT "Nota_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Nota" ADD CONSTRAINT "Nota_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_barberId_fkey" FOREIGN KEY ("barberId") REFERENCES "Barbeiro"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sessao" ADD CONSTRAINT "Sessao_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
