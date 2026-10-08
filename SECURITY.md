# Segurança da Barbearia

## Instalação
```bash
npm install
npm run setup   # em dev cria o .env.local com segredos aleatórios (edite DATABASE_URL)
npm run db:setup
```
Em produção, configure as variáveis do `.env.example` no painel do host (nunca em arquivo versionado): `DATABASE_URL`, `JWT_SECRET` (`openssl rand -base64 48`), `SEED_ADMIN_PASSWORD` (e `SEED_ADMIN_EMAIL`), `APP_ORIGIN` e `TRUST_PROXY`; depois `npm run db:deploy` e `NODE_ENV=production npx tsx prisma/seed.ts` (cria só o dono, o horário e os serviços padrão).

## Ameaça → defesa
| Ameaça | Defesa | Arquivo |
|---|---|---|
| Acesso a painel sem permissão | Middleware valida o JWT e o role da rota; a API revalida no servidor | `middleware.ts`, `auth.ts` |
| Cliente vendo dados de outro (IDOR) | Toda rota confere o dono do registro; listas filtradas no servidor | `agendamentos/**` |
| Cliente virando admin | Cadastro só aceita cliente/barbeiro; `admin` é ignorado; barbeiro exige convite individual (uso único, validade, só o hash guardado) gerado pelo dono | `cadastro/route.ts`, `db.ts` |
| Barbeiro colhendo dados de clientes | Agendar para cliente exige `equipeAcessaCliente` (só quem ele atendeu/cadastrou); dono vê todos | `agendamentos/route.ts`, `db.ts` |
| Força bruta | 5 falhas em 15 min por IP e por e-mail => bloqueio de 15 min. O IP encaminhado só é confiável em dev ou com `TRUST_PROXY=1`; sem isso fica como desconhecido | `rateLimit.ts`, `audit.ts`, `login/route.ts` |
| Enumeração de usuários | Mensagem única "Email ou senha inválidos" + mesmo tempo de resposta (hash falso) | `hash.ts` |
| Roubo de token via XSS | Tokens só em cookie httpOnly; nada em localStorage; CSP com nonce | `auth.ts`, `middleware.ts` |
| CSRF | SameSite=Strict + checagem de Origin + token double submit | `auth.ts` (`verificarCsrf`) |
| Session fixation / sessão roubada | Novo sid a cada login/refresh, refresh rotativo com detecção de reuso, logout invalida no servidor | `auth.ts` |
| Clickjacking | `X-Frame-Options: DENY` + `frame-ancestors 'none'` | `next.config.js`, `middleware.ts` |
| Isolamento entre barbearias | Sessão determina o tenant interno; o slug determina o tenant público; consultas e gravações incluem `barbeariaId` | `auth.ts`, `tenant-scope.ts`, rotas `api/**` |
| Injeção / payload malformado | Zod em todo endpoint, sanitização de texto, o cliente nunca envia preço/duração/clienteId | `validation.ts`, `sanitize.ts` |
| Vazamento nas respostas | DTOs com só os campos necessários; senha/hash nunca saem; erros genéricos | `db.ts` (`dto`), `auth.ts` (`seguro`) |
| Escalada por tentativas | 3 acessos indevidos => sessão destruída (ID inexistente não conta, para não derrubar tela desatualizada) | `auth.ts`, `agendamentos/[id]` |
| Cancelamento abusivo | Cliente só cancela com `cancelamentoHoras` de antecedência (equipe não tem o limite) | `agendamentos/[id]/route.ts` |

## Fluxo de sessão
1. Login valida CSRF, rate limit e senha (bcrypt, 12 rounds), cria sessão nova e grava dois cookies httpOnly: `bb_at` (JWT, 15 min) e `bb_rt` (refresh, 7 dias, enviado só para `/api/auth`).
2. O middleware (Edge) só verifica a assinatura do JWT e o role para decidir a rota. Ele não consegue consultar a lista de sessões, por isso **toda API revalida a sessão e o role no servidor**.
3. Com o access token expirado, o middleware redireciona para `/api/auth/refresh`, que rotaciona os tokens e volta para a página.
4. Logout apaga a sessão no servidor e limpa os cookies. O JWT antigo deixa de valer nas APIs na hora.

## Ligando as telas (exemplos)
Login:
```tsx
const login = useAuth((s) => s.login)
const erro = await login(email, senha)           // mensagem genérica vinda do servidor
if (erro) return setErro(erro)
router.replace({ cliente: '/cliente/agendar', barbeiro: '/barbeiro/agenda', admin: '/admin/dashboard' }[useAuth.getState().usuario!.role])
```
Cadastro (checkbox LGPD obrigatório; o role vem da tela escolhida, mas o servidor decide):
```tsx
<label><input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} />
  Aceito os termos e a <a href="/privacidade">política de privacidade</a></label>
const erro = await cadastrar({ nome, telefone, email, senha, aceitoTermos: aceito, role, codigoConvite })
```
Painéis: troque leituras do store/mock por `api('/api/agendamentos')`, `api('/api/agendamentos', {method:'POST', body: JSON.stringify({servicoId, barberId, data, hora})})` e `api('/api/agendamentos/ID', {method:'PATCH', body: JSON.stringify({status:'concluido'})})`.
Excluir conta: `api('/api/meus-dados', {method:'DELETE', body: JSON.stringify({confirmar:true})})`.

## Limitações deste MVP (leia antes de publicar)
- **Dados, sessões, rate limit e auditoria ficam no PostgreSQL** (Prisma). Funciona com várias instâncias e sobrevive a reinício. Se o tráfego crescer muito, o rate limit e as sessões podem migrar para Redis. Agendamento duplo é barrado por trava por barbeiro (transação) e por índice único parcial (`prisma/indices.sql`).
- Use um usuário do banco com poucos privilégios em produção (não o `postgres`), conexão com TLS (`?sslmode=require`) e backups automáticos. Localmente, `npm run db:backup` cria e valida um dump datado antes de mudanças importantes.
- A auditoria guarda IP e user-agent por 90 dias (limpeza automática); informe isso na política de privacidade.
- `TRUST_PROXY=1` só se houver proxy/CDN seu reescrevendo `x-forwarded-for`; sem ele, o IP vem da conexão.
- O cookie CSRF não é assinado; em produção o prefixo `__Host-` mitiga cookie injection por subdomínio.
- Refresh simultâneo em duas abas pode ser lido como reuso e encerrar a sessão (o usuário só loga de novo).
- Cadastro com e-mail ou telefone já existente retorna 409 genérico; ainda há alguma enumeração (limitada pelo rate limit).
- O bloqueio de login por e-mail pode ser usado para travar a conta de outra pessoa por 15 min (custo aceito contra força bruta).
- Sem recuperação de senha, MFA ou captcha.
- O MVP usa PostgreSQL compartilhado entre tenants. `npm run test:isolation` cobre catálogo, reserva pública, serviços, profissionais, clientes, ficha, observações internas, agenda, caixa, horários, bloqueios, convites, relatórios e cancelamentos com duas barbearias e IDs cruzados. Antes de dados reais em produção, amplie a cobertura para as demais transições de agendamento e jornadas de cada perfil.
- Onboarding cria dono, identidade e horário padrão; o responsável ainda precisa cadastrar equipe e serviços antes de o link aceitar reservas.
- Onboarding tem limite de tentativas e CSRF, mas não verifica e-mail nem usa CAPTCHA. Em produção, ele fica bloqueado por padrão; só é liberado com `ONBOARDING_PUBLICO=1`. Não ative essa variável antes de decidir e aplicar controles antiabuso adicionais.
- Desativar um barbeiro agora invalida as sessões existentes e a autenticação rejeita contas inativas.
- Atendimentos concluídos e cancelados são terminais e não podem ser excluídos pela API. Ainda falta um fluxo auditável de estorno/correção financeira.
- Telas Next disponíveis: cliente, barbeiro e dono, incluindo fichas, serviços, horários, bloqueios e agendamento de balcão.

## Antes de ir para produção
`npm audit` sem vulnerabilidades altas/críticas (na verificação local de 2026-10-07, o lockfile não apresentou avisos; reexecute antes de publicar), `npm run db:backup`, `npm run check:production`, `npm run prod` para testar a CSP, HTTPS no domínio, `APP_ORIGIN` correto, `JWT_SECRET` forte e só no painel do host, backup do banco, retenção/rotação dos logs (contêm IP), revisão dos textos legais e de como os dados do tenant aparecem em `/privacidade`, testes de integração de isolamento e um teste de invasão (pentest) feito por profissional. A hospedagem pode acompanhar `GET /api/health`, que não expõe detalhes internos. Mantenha Next.js numa linha com suporte de segurança e aplique os patches publicados. Nenhuma camada garante segurança total.

## Como testar rápido
- `npm test` cobre as regras de horário (grade, almoço, bloqueio, conflito, janela) e os cálculos financeiros, sem banco.
- Logue como cliente e abra `/admin/dashboard` => `/403`; 3 vezes seguidas encerram a sessão.
- Com dois clientes, tente `GET /api/agendamentos/ID` do outro => 403.
- 6 logins errados => 429 com `Retry-After`.
- Cadastro com `"role":"admin"` => conta criada como cliente.
