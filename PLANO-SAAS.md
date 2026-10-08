# Plano de evolução para SaaS multiempresa

## Objetivo

Uma única plataforma atende várias barbearias. Cada negócio configura nome, slug, logo, cores, serviços, profissionais e horários, e compartilha um link público de agendamento como `/agendar/{slug}`. Os dados e permissões de uma barbearia nunca podem atravessar para outra.

## Estado atual

- O modelo `Barbearia` e o vínculo obrigatório de tenant nos registros operacionais já estão no schema Prisma.
- A migração aditiva `20261007000000_tenant_foundation` foi aplicada ao banco PostgreSQL local `barbearia`, após backup e autorização do dono.
- Sessões carregam a barbearia do usuário no banco; APIs internas de agenda, clientes, equipe, serviços, horários, bloqueios, financeiro e auditoria filtram pelo tenant da sessão.
- Dono e profissional continuam com uma conta vinculada a uma única barbearia. O cadastro de profissional resolve o tenant pelo convite.
- A página pública `/agendar/{slug}` já lê identidade visual, catálogo e disponibilidade da barbearia resolvida pelo slug.
- Reserva pública grava cliente sem login, aceita nome/telefone, aplica rate limit e valida novamente o horário no servidor.
- A loja inicial usa o slug `barbearia-exemplo`; o painel permite editar nome, frase, slug e cores, além de copiar/abrir o link público. O onboarding de novas lojas foi implementado, mas ainda não está pronto para lançamento público: falta verificação de e-mail e teste de integração.
- Há cópia antiga em `barbearia/`; está fora da checagem TypeScript, mas não foi apagada.

## Estratégia inicial

Usar banco PostgreSQL compartilhado com `barbeariaId` em todos os registros pertencentes ao negócio. A resolução do tenant acontece no servidor a partir do slug/host; nunca confiar num `barbeariaId` enviado livremente pelo navegador. Cada consulta e autorização precisa incluir o tenant atual.

Esse modelo é econômico para validar o produto, mas aumenta o impacto potencial de uma consulta sem filtro. Antes de dados de clientes reais, testes automatizados devem provar que usuários de A não leem nem alteram dados de B. Uma futura opção de banco dedicado por cliente pode ser avaliada se algum plano exigir isolamento maior.

## Sequência de implementação

1. Definir identidade e papéis: decidir se uma conta pode pertencer a várias barbearias e se cliente agenda sem criar senha. Recomendada: membership equipe por tenant; cliente pode agendar pelo link com nome/telefone, sem conta obrigatória.
2. Modelar `Barbearia` e `MembroBarbearia`; definir slug único, proprietário inicial e estados de assinatura/ativação sem implementar cobrança ainda.
3. Criar migração não destrutiva: criar uma barbearia padrão para os dados atuais, associar todos os registros existentes a ela e só depois tornar as relações obrigatórias. Fazer backup antes; não usar `migrate reset`.
4. Adicionar tenant às tabelas operacionais: usuários/memberships, barbeiros, serviços, horários, bloqueios, clientes, agendamentos, notas, convites e auditoria. Definir unicidade por barbearia quando aplicável.
5. Resolver o tenant e membership no servidor. Aplicar autorização por tenant em todas as rotas; nunca aceitar o papel ou tenant como autoridade do cliente.
6. Adaptar primeiro os endpoints e testes de isolamento; cobrir IDs próprios, IDs de outro tenant, slug inválido e usuário membro de mais de uma barbearia.
7. Persistir branding e configuração por barbearia. Gerar página pública `/agendar/{slug}` responsiva e com disponibilidade calculada no servidor.
8. Fazer onboarding do dono, criação/validação de slug e gestão de equipe. Domínio próprio, cobrança recorrente, notificações e app nativo ficam para fases posteriores.
9. Validar migração com cópia do banco, testes, lint, typecheck e build em ambiente que permita criar processos. Só então publicar.

## Decisões confirmadas

- Cada conta de dono/profissional pertence a uma barbearia; uma conta não administra várias lojas.
- O cliente pode agendar pelo link usando nome e telefone, sem criar senha.

## Fase 1: fundação e isolamento de tenant

- Adicionado o modelo `Barbearia` com slug e identidade visual persistidos.
- Criada migração aditiva que insere a barbearia inicial e associa os registros atuais a ela sem removê-los.
- Adicionadas normalização e validação de slug, incluindo nomes com acentos e rotas reservadas.
- A barbearia do usuário é carregada do banco na autenticação; a API não confia em tenant enviado pelo navegador.
- As rotas internas de operação foram escopadas por tenant e as gravações exigem `barbeariaId` no schema.
- A migração foi aplicada ao banco local; não publicar onboarding/segunda loja até validar a jornada pública e o isolamento entre tenants.
- Verificações da fundação: `prisma validate`, `npm run typecheck`, `npm run lint` e 11 testes unitários.
- O dono confirmou que `npm run build` concluiu com sucesso para a fundação. Repetir depois desta nova página pública.

## Próxima fase

1. Automatizar testes com duas barbearias cobrindo criação, leitura, escrita e IDs de outro tenant (cobertura para catálogo, reservas, clientes, ficha, notas, agenda, serviços, profissionais, financeiro, horários, bloqueios, convites, relatórios e cancelamentos concluída na Fase 6; ampliar para as demais transições de agendamento e jornadas de cada perfil).
2. Implementar verificação de e-mail e proteção antiabuso antes de liberar o onboarding publicamente.
3. Validar o onboarding e a configuração inicial da equipe/serviços em banco de teste isolado.
4. Rodar build e jornada completa em um ambiente que permita iniciar os processos do Next.js; preparar backup/rollback antes de publicar.

## Fase 2: agendamento público inicial

- Criada a rota `/agendar/{slug}` com catálogo ativo, profissionais, datas, horários e formulário de nome/telefone.
- Criadas APIs públicas que resolvem o tenant pelo slug, filtram cada recurso pelo `barbeariaId` resolvido no servidor e não aceitam tenant livre do cliente.
- Reservas validam CSRF, rate limit, aceite dos termos, serviço/profissional ativo e disponibilidade em transação.
- Clientes sem senha ficam marcados como `semConta`, reutilizam telefone dentro da barbearia e não podem autenticar.
- A home da instalação inicial direciona o botão de agendamento para `/agendar/barbearia-exemplo`.
- A migração `20261007000000_tenant_foundation` foi aplicada ao banco local após backup. As APIs públicas de catálogo (`3` barbeiros/`3` serviços) e disponibilidade responderam `200`; a tela abriu em `http://localhost:3001/agendar/barbearia-exemplo` e o navegador concluiu reservas (`201`).

## Fase 3: identidade e link público no painel

- Adicionada API administrativa de leitura e atualização da marca, sempre escopada à barbearia da sessão.
- Validados nome, frase, cores hexadecimais e slug; a API rejeita slugs reservados ou já utilizados.
- A tela de configurações permite pré-visualizar a identidade, copiar o endereço e abrir a página pública.
- Typecheck, lint e 14 testes unitários passam. O runner padrão falha neste ambiente com `spawn EPERM`; os mesmos testes passaram pela execução direta do Node.
- Dump pré-migração criado em `C:\Users\Bessa\Desktop\Backup-Barbearia\Backup-Barbearia-banco-20261007-080520.dump`; catálogo e conteúdo completo foram lidos pelo `pg_restore`.
- A migração foi aplicada localmente em transação única e registrada com o checksum do arquivo. Foram confirmados 3 usuários, 3 barbeiros, 3 serviços, 1 agendamento, 2 convites e 1 horário no tenant inicial.
- Typecheck e lint passaram; 14 testes unitários passam pela execução direta do Node. O build e a verificação de status do Prisma CLI seguem bloqueados neste ambiente por `spawn EPERM`; o preview de desenvolvimento usa uma configuração local com threads, sem afetar build ou produção.

## Fase 4: onboarding inicial

- Criada a página `/criar-barbearia` para identidade, slug, cores e dados do responsável.
- Criada a API `/api/onboarding`: limita tentativas, valida termos/senha/slug, cria barbearia, responsável admin e horário padrão na mesma transação, e inicia sessão.
- Adicionados links de entrada na home e no login; os testes cobrem os principais limites da validação.
- Requisição sem token CSRF foi recusada com `403`, antes de acessar a criação.
- O fluxo foi exercitado em banco PostgreSQL temporário isolado: onboarding criou um tenant e sessão (`201`), o dono autenticou, criou profissional e serviço (`201` cada), e IDs de recursos de outra barbearia foram recusados (`400`). A base temporária será removida após os testes.
- Não há verificação de e-mail ou CAPTCHA; por isso, o cadastro público de novas barbearias fica bloqueado por padrão em produção e só é liberado com `ONBOARDING_PUBLICO=1` após decidir e implementar essas proteções antiabuso.
- O agendamento agora recupera o estado de envio/consulta quando há falha de rede, com ação de tentar novamente. O painel do dono orienta o cadastro inicial de equipe/serviços quando o tenant ainda não pode receber reservas.
- `npm run typecheck`, `npm run lint` e 14 testes unitários passaram após os ajustes. O build de produção continua bloqueado neste ambiente por `spawn EPERM`.

## Fase 5: segurança e estabilização

- Next.js foi atualizado da versão `14.2.35` para `15.5.27` (linha de manutenção), com React e tipos em `19.3.0`. `getIp` foi adaptado à remoção de `NextRequest.ip` sem confiar em cabeçalhos não autorizados.
- Parâmetros dinâmicos das páginas e APIs agora são aguardados conforme a nova API do Next. O lint passou a usar ESLint CLI; `typecheck`, lint e 14 testes unitários passaram após o upgrade. O preview está disponível em `http://localhost:3001`.
- Em 2026-10-07, `npm audit` e `npm audit --omit=dev` não listaram vulnerabilidades para o lockfile atual. Reexecutar a auditoria antes de publicar, pois os avisos mudam com o tempo. A atualização para Next 16 continua sendo uma migração maior e não deve ser feita apenas por versão; exige validar `proxy.ts`, Turbopack e a aplicação inteira.
- O runner padrão dos testes unitários foi trocado por uma execução no mesmo processo para contornar `spawn EPERM`; detalhes e resultado atual na Fase 6.
- Snapshot do código pré-upgrade criado em `C:\Users\Bessa\Documents\Codex\Backup-Barbearia-codigo-pre-upgrade-20261007-092143.zip`, sem `.env.local` nem cópia do banco.

## Fase 6: testes multiempresa e onboarding

- Adicionado `npm run test:isolation`, com banco dedicado terminado em `_test`, proteção para nunca usar o banco principal e limpeza limitada aos fixtures criados pelo teste.
- As rotas reais confirmam que o catálogo da loja A não mostra a loja B, uma reserva válida grava no tenant correto, e IDs de barbeiro/serviço de outra loja são recusados sem alterar dados.
- Clientes, fichas, observações internas, agenda e caixa foram exercitados com duas lojas; as leituras retornam somente o tenant da sessão, e tentativas de acessar ou escrever em cliente de outra loja retornam acesso negado sem gravar a observação.
- A API administrativa lista apenas serviços do tenant da sessão e rejeita alteração por ID de outra loja (`404`).
- Duas chamadas simultâneas de onboarding com mesmo slug/e-mail produzem um cadastro (`201`) e um conflito (`409`); slug ou e-mail já usado também é recusado. Cadastro e horário padrão são gravados atomicamente.
- Verificação: `npm test` (15/15), `npm run test:isolation` (9/9), typecheck, lint e `npm audit --omit=dev` passaram. A cópia temporária chegou à etapa de compilação de produção após desativar o worker de build do Webpack, mas a finalização completa do build ainda precisa ser confirmada; o preview original permaneceu no ar em `http://localhost:3001` (`200`).
- O preview pode ser iniciado com `npm run dev:local` neste Windows quando `npm run dev` falhar com `spawn EPERM`; a página inicial resolve o slug da barbearia padrão pelo banco, evitando links públicos desatualizados após uma alteração no painel.
- O cadastro público de novas barbearias ficou bloqueado por padrão em produção; só deve ser ativado via `ONBOARDING_PUBLICO=1` depois de configurar confirmação de e-mail e proteção antiabuso.
- Adicionado `npm run db:backup`, que cria um dump PostgreSQL datado na pasta `Backup-Barbearia` e valida o arquivo com `pg_restore` antes de informar sucesso.

## Fora da primeira entrega SaaS

Pagamento/assinatura da plataforma, domínio customizado, integração WhatsApp, estoque, emissão fiscal, multiunidade dentro de uma marca e recuperação de senha exigem decisões e serviços próprios; não devem ser misturados à primeira migração de isolamento.
