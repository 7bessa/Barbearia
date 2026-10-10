CREATE UNIQUE INDEX "Assinatura_uma_aberta_por_barbearia_key"
ON "Assinatura"("barbeariaId") WHERE "status" IN ('criando', 'pending');
