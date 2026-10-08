-- Rede de segurança contra agendamento duplo (mesmo barbeiro, data e hora), além da trava por barbeiro no código.
-- O Prisma não declara índice parcial, por isso fica em SQL. É idempotente (pode rodar várias vezes).
CREATE UNIQUE INDEX IF NOT EXISTS "agendamento_horario_ativo"
  ON "Agendamento" ("barberId", "data", "hora")
  WHERE "status" <> 'cancelado';
