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
- Contas novas agora exigem confirmação de e-mail; recuperação de senha usa token de uso único e invalida as sessões antigas. Produção deve configurar `RESEND_API_KEY`, `EMAIL_FROM` e `APP_ORIGIN`; a compilação de deploy reprova se faltarem.
- Adicionado `npm run db:backup`, que cria um dump PostgreSQL datado na pasta `Backup-Barbearia` e valida o arquivo com `pg_restore` antes de informar sucesso.

## Fora da primeira entrega SaaS

Domínio customizado, integração WhatsApp, emissão fiscal e multiunidade dentro de uma marca continuam fora da primeira entrega SaaS. A cobrança recorrente da plataforma foi implementada localmente na etapa de preparação para piloto abaixo; recuperação de senha também foi implementada.

## Preparação para piloto comercial (2026-10-09)

### Concluído localmente

- Cadastro de contas e abertura de barbearia criam contas pendentes; login só é liberado depois da confirmação do e-mail.
- Confirmação usa token aleatório com hash no banco, validade de 24 horas e uso único. Recuperação de senha usa token de 1 hora, resposta genérica contra enumeração e revoga as sessões após a troca.
- Adicionadas as páginas de confirmar/re-enviar e-mail, esqueci a senha e redefinir a senha; em ambiente local, os links de teste são apresentados na tela.
- Aplicada localmente a migração aditiva `20261009100000_account_email_security`. O schema legado mantém as contas existentes verificadas por padrão.
- `vercel-build` agora reprova deploy se faltarem `DATABASE_URL`, `JWT_SECRET`, `APP_ORIGIN`, `RESEND_API_KEY` ou `EMAIL_FROM`.
- O preflight também rejeita banco local/de teste, origem de exemplo, segredo padrão, chave com formato inválido, remetente de demonstração e os dados legais fictícios em `src/config/barbearia.ts` (incluindo CNPJ sem dígitos verificadores válidos), antes de o deploy tentar aplicar migrações. Isso valida formato e bloqueia os exemplos atuais, mas não confirma que a empresa e os contatos existem nem substitui revisão jurídica.
- O deploy exige `TRUST_PROXY=1` para não transformar o rate limit em uma chave única compartilhada quando publicado atrás da Vercel. A plataforma sobrescreve `X-Forwarded-For` com o IP do cliente, conforme a [documentação oficial de cabeçalhos da Vercel](https://vercel.com/docs/headers/request-headers).
- Backup PostgreSQL local validado antes da migração: `C:\Users\Bessa\Desktop\Backup-Barbearia\Backup-Barbearia-barbearia-2026-10-09_23-22-22-159.dump`.
- Checkpoint validado após a migração: `C:\Users\Bessa\Desktop\Backup-Barbearia\Backup-Barbearia-barbearia-2026-10-09_23-37-12-693.dump`.
- Verificações locais: testes principais 15/15, isolamento 9/9, lint, typecheck e build de produção aprovados. `npm audit --omit=dev` reportou zero vulnerabilidades depois de fixar PostCSS em `8.5.29`.

### Bloqueios antes de vender

1. Configurar e validar no Vercel o domínio remetente do Resend e preencher `RESEND_API_KEY`, `EMAIL_FROM` e `APP_ORIGIN`. A checagem do projeto valida presença e formato, não comprova domínio ou entrega real.
2. Definir os preços finais, criar os planos reais no Mercado Pago e configurar credenciais/IDs no Vercel. O checkout, webhook assinado, cancelamento e bloqueio após trial estão implementados e cobertos por testes simulados, mas ainda não foram validados com uma conta real do provedor.
3. Substituir os dados fictícios de empresa em `src/config/barbearia.ts` e pedir revisão jurídica dos termos, privacidade, papéis de controlador/operador, retenção, suporte e política de cancelamento. A revisão encontrou que `/termos` descreve o pagamento do atendimento na loja, mas ainda não cobre de forma suficiente a assinatura recorrente da plataforma; `/privacidade` usa uma única identidade legal global, embora cada barbearia opere seus próprios dados de clientes. A política também deve definir expressamente carência para cobrança recusada e efeito do cancelamento; o sistema não bloqueia automaticamente por fatura recusada. Não publicar os exemplos como dados reais.
4. Validar em produção, com e-mail real, pagamento de teste e contas separadas de dono, atendente, barbeiro e cliente; verificar as configurações do PostgreSQL hospedado antes da migração automática do deploy. O preflight agora reprova deploy sem as quatro variáveis do Mercado Pago.
5. Configurar backup automático e monitoramento externo do banco e do site; o dump atual é apenas uma cópia local, não uma estratégia de recuperação do serviço online.
6. Auditoria de dependências: a execução mais recente em 2026-10-10 (`npm audit`) não encontrou vulnerabilidades. Repetir antes de cada publicação, pois os avisos mudam com as versões e o registro.

O preview de verificação fica em `http://127.0.0.1:3001`. As alterações desta etapa permanecem locais e ainda não foram enviadas ao GitHub.

### Revalidação em 2026-10-09

- Testes unitários: 15/15 aprovados; typecheck e lint aprovados; auditoria de dependências de produção: zero vulnerabilidades reportadas.
- O banco padrão da suíte (`barbearia_isolation_test`) é legado: não tem tabela `_prisma_migrations` e contém somente as colunas iniciais. Foi preservado intacto. Reexecutando os mesmos testes no banco separado já migrado `barbearia_codex_a4a40623_test`, os 9/9 cenários de isolamento passaram.
- O primeiro `next build` foi bloqueado por `spawn EPERM`; após parar o servidor local e executar o build com a permissão do sistema operacional necessária, o build de produção concluiu com sucesso, incluindo compilação, tipos, páginas e traces.
- O preview foi reiniciado e as rotas `/login`, `/cadastro`, `/criar-barbearia`, `/verificar-email`, `/esqueci-senha`, `/redefinir-senha` e `/api/health` responderam `200`.

### Cobrança recorrente local (2026-10-10)

- Adicionada tabela de assinaturas e índice único parcial para permitir somente um checkout aberto por barbearia; migrações aplicadas aos bancos locais após backup validado. Nenhuma migração foi enviada à produção.
- Adicionada tela `/admin/assinatura`, consulta de valores/frequência diretamente dos planos cadastrados no Mercado Pago, criação de checkout, reutilização do checkout pendente, cancelamento e webhook HMAC-SHA256 que consulta o estado real no provedor antes de atualizar o acesso. O webhook também acompanha faturas recorrentes (`subscription_authorized_payment`) e exibe a última cobrança da assinatura atual; falhas são registradas sem suspender acesso automaticamente até que a carência comercial seja definida.
- Contas em trial vencido recebem `402` nas APIs protegidas; a página de assinatura e a sessão permanecem acessíveis ao dono. Catálogo, disponibilidade e reservas públicas ficam ocultos quando o trial/assinatura não dá acesso.
- Limite de profissionais agora é validado no cadastro por convite e na inclusão manual. A criação ativa usa bloqueio transacional por barbearia para impedir que chamadas simultâneas ultrapassem o plano; o responsável também não consegue emitir novos convites de barbeiro quando já atingiu o limite.
- Uma falha de rede ao abrir checkout mantém a tentativa `criando`; novo clique reaproveita o mesmo ID e a chave de idempotência, evitando uma segunda assinatura se a primeira resposta do provedor tiver se perdido. Rejeições HTTP 4xx definitivas marcam a tentativa como falha e permitem criar outra após corrigir a configuração; timeout, conflito e limite de requisição permanecem recuperáveis pela mesma tentativa. Ambos os caminhos foram exercitados em integração.
- Recuperação de senha e reenvio de verificação mantêm respostas idênticas quando o provedor de e-mail falha, evitando revelar se um endereço tem conta; a falha fica registrada para suporte.
- As telas de confirmação e redefinição enviam `Cache-Control: no-store` e `Referrer-Policy: no-referrer`; também removem o token da barra de endereço após carregá-lo. O middleware aplica ainda `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY` e uma política mínima de permissões.
- Inter e Playfair Display agora são servidas localmente, sem requisições a Google Fonts; seis arquivos WOFF2 foram conferidos no build de produção. O CSP permanece restrito a `self` para fontes.
- `next.config.js` e o middleware foram alinhados para que `Referrer-Policy: no-referrer` prevaleça também no build publicado e as páginas `/verificar-email` e `/redefinir-senha` usem `Cache-Control: no-store`; os cabeçalhos e os arquivos WOFF2 foram verificados por HTTP em servidor de produção local.
- Recuperação operacional exercitada: o dump principal mais recente foi restaurado em uma base temporária isolada; as tabelas `Barbearia`, `Usuario` e `_prisma_migrations` foram confirmadas, e somente a base temporária criada para o teste foi removida. O dump e o banco principal permaneceram intactos. Isso valida o procedimento local, mas não substitui backup automático nem teste de restauração no provedor hospedado.
- Testes simulados cobrem checkout repetido, troca enquanto há pagamento pendente, webhook autorizado/cancelado, fatura recorrente recusada e isolamento por barbearia, validação de assinatura e bloqueio de trial vencido.
- Validação registrada nesta etapa: 18/18 testes unitários, typecheck, lint, build de produção e `git diff --check` aprovados. Em 2026-10-10, `npm audit` completo não encontrou vulnerabilidades; a suíte de isolamento passou 12/12 no banco atualizado indicado em `DATABASE_URL_TEST`. O banco legado selecionado por padrão foi preservado e não serve para esses testes. As rotas de acesso/tokens e `/api/health` responderam `200`; cabeçalhos e WOFF2 foram conferidos por HTTP. O preflight bloqueia configuração ausente e identidade legal de demonstração; não comprova a entrega/cobrança dos provedores.
- Preview local atualizado em `http://127.0.0.1:3002`. Alterações ainda não foram enviadas ao GitHub.

### Revalidação adicional (2026-10-10)

- `npm test`: 18/18 aprovados; typecheck, lint e auditoria completa (`npm audit`) aprovados.
- A suíte de isolamento falha se apontar para o banco legado `barbearia_isolation_test`, que não possui a coluna `Barbearia.existe`. O banco foi preservado sem alterações; executando a mesma suíte no banco de teste atualizado `barbearia_codex_a4a40623_test`, os 12/12 cenários passaram. Configure `DATABASE_URL_TEST` para uma base de teste migrada e terminada em `_test` antes de executar a suíte neste computador.
- As alterações continuam locais e não foram enviadas ao GitHub. Continuam pendentes credenciais/configuração dos provedores, dados legais reais e revisão jurídica, teste com serviços reais, configuração de backup e monitoramento hospedados. Domínio próprio segue opcional e fora do primeiro piloto.
