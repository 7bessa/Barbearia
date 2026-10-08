# Recursos: financeiro, clientes, rotas do dono e textos legais

As rotas internas exigem sessão e CSRF (header `x-csrf-token`, já feito pelo `api()` de `src/lib/api-client.ts`). As rotas de catálogo, disponibilidade e reserva pública são exceções: resolvem a barbearia pelo slug e aplicam limites de uso. Quem pode nas rotas protegidas: **A** = dono, **B** = barbeiro, **C** = cliente.

## Configuração por barbearia
Nome, frase, slug e cores são gravados por tenant e podem ser alterados na área **Configurações** do dono. O link público fica em `/agendar/{slug}` e clientes agendam sem conta usando nome e telefone. `src/config/barbearia.ts` ainda guarda dados legais/de contato, política e antecedência de cancelamento (`cancelamentoHoras`), grade de horários (`passoMinutos`), validade do convite (`conviteHoras`), horário padrão e comissão padrão; termos e privacidade ainda usam parte desses dados globais, não uma configuração legal independente para cada tenant.

O banco PostgreSQL é compartilhado e o schema vincula registros operacionais à barbearia. `npm run test:isolation` exercita as rotas reais com duas barbearias num banco PostgreSQL separado: catálogo, reserva válida, agenda, clientes, ficha, observações internas, caixa, serviços, profissionais e comissões, horários, bloqueios, convites, relatórios financeiros, cancelamento e IDs estrangeiros no agendamento e edição administrativa, além de colisões simultâneas no onboarding. O script usa `DATABASE_URL_TEST` ou deriva `<banco-principal>_isolation_test`, exige que o nome termine em `_test`, nunca usa nem apaga o banco principal e remove apenas os dados temporários que criou. Crie esse banco vazio e aplique as migrações antes de rodar o teste.

## Financeiro (dono)
| Rota | O que faz |
|---|---|
| `GET /api/admin/financeiro/caixa?data=YYYY-MM-DD` | Caixa do dia: total, por forma de pagamento, por barbeiro, comissões, valor a receber e cada movimento |
| `GET /api/admin/financeiro/relatorio?mes=YYYY-MM` | Relatório mensal: bruto, comissões, líquido, ticket médio, faltas e taxa de falta, por barbeiro/serviço/dia |
| `GET /api/admin/financeiro/relatorio?mes=YYYY-MM&formato=csv` | Mesmo relatório em CSV (abre no Excel) |
| `GET /api/barbeiro/comissao?mes=YYYY-MM` (B) | O barbeiro vê só os atendimentos e a comissão dele |

**Baixa com pagamento:** `PATCH /api/agendamentos/ID` com `{"status":"concluido","formaPagamento":"pix"}` (dinheiro, pix, debito, credito). A forma é obrigatória e a % de comissão é congelada nesse momento: mudar a comissão depois não altera o passado. Valores são calculados em centavos.

## Clientes (A, B)
| Rota | O que faz |
|---|---|
| `GET /api/clientes?q=&pagina=` | Lista com busca por nome/telefone. Barbeiro só vê os dele; dono vê todos (+ e-mail e total gasto) |
| `POST /api/clientes` | Cadastra cliente de balcão (sem login) com nome completo e telefone |
| `GET /api/clientes/ID` | Ficha: resumo, histórico de atendimentos e observações |
| `POST /api/clientes/ID/notas` | Adiciona observação interna (o cliente nunca vê) |
| `DELETE /api/clientes/ID/notas?notaId=N` | Remove observação (autor ou dono) |

`POST /api/agendamentos` também aceita barbeiro/dono agendando para um cliente: envie `clienteId`. Barbeiro só pode agendar para cliente que já atendeu ou que ele cadastrou; o dono, para qualquer um. A equipe pode encaixar horários de hoje que já começaram, em múltiplos de 5 min, e agendar até 60 dias à frente. O cliente usa a grade de `passoMinutos`.

`GET /api/disponibilidade?barberId=&servicoId=&data=YYYY-MM-DD` (todos logados): horários livres para o serviço na data.

**Cancelamento** (`PATCH` com `{"status":"cancelado"}`): cliente só até `cancelamentoHoras` antes; barbeiro (dos seus atendimentos) e dono, a qualquer momento. Só atendimentos `agendado` podem ser cancelados.

## Rotas do dono (A)
| Rota | O que faz |
|---|---|
| `GET/POST /api/admin/barbeiros`, `PATCH/DELETE /api/admin/barbeiros/ID` | CRUD de barbeiros (nome, comissão %, ativo) |
| `GET/POST /api/admin/servicos`, `PATCH/DELETE /api/admin/servicos/ID` | CRUD de serviços (nome, preço, duração, ativo) |
| `GET/PUT /api/admin/horarios` | Abre/fecha, almoço e dias de funcionamento |
| `POST /api/admin/convites` | Gera código de convite de barbeiro (uso único, expira em `conviteHoras`; aparece só nesta resposta). `GET` mostra quantos estão pendentes |
| `GET /api/admin/auditoria` | Últimos 100 eventos de segurança (login, acesso negado, CSRF...) |
| `GET/POST /api/bloqueios`, `DELETE /api/bloqueios/ID` (A, B) | Folgas, almoço e férias. Barbeiro só mexe nos dele |
| `GET /api/catalogo` (todos logados) | Barbeiros e serviços ativos + horário, para a tela de agendar |
| `GET /api/publico/{slug}` | Catálogo público ativo e identidade visual da barbearia |
| `GET /api/publico/{slug}/disponibilidade?barberId=&servicoId=&data=` | Horários públicos disponíveis para aquele tenant |
| `POST /api/publico/{slug}` | Reserva sem senha com nome/telefone; confirma disponibilidade e valida tenant no servidor |
| `POST /api/onboarding` | Cria barbearia, dono e horário padrão; o dono entra autenticado e configura equipe/serviços |

Excluir barbeiro ou serviço com histórico apenas **desativa** (preserva o financeiro). Bloqueio não é aceito por cima de atendimento já marcado.

## LGPD
- Cliente que exclui a conta tem nome, telefone e observações apagados; atendimentos já pagos ficam **anonimizados** (obrigação fiscal).
- Barbeiro excluído: a autoria das observações que escreveu passa a "Profissional removido".
- Cliente de balcão: avise que os dados serão usados para agendamento e contato, e evite anotar dados sensíveis nas observações.
- Troque os textos de `/termos` e `/privacidade` pelos da sua revisão jurídica: são modelos, não substituem um advogado.

## Ainda não incluído
Despesas (aluguel, produtos) e lucro real, fechamento de caixa com sangria/troco, venda de produtos, pagamento online, lembretes por WhatsApp, recuperação/troca de senha, verificação de e-mail, proteção adicional contra abuso no onboarding, domínio próprio por tenant e configuração legal independente por barbearia.
