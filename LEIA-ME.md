# Barbearia – como rodar no VS Code

## 1. Requisitos
Node.js LTS (18.18 ou maior): https://nodejs.org. Confira com `node -v`.

## 2. Banco de dados (PostgreSQL 16)
Instale o PostgreSQL e crie um banco vazio chamado `barbearia` (pgAdmin: Databases > Create > Database).

```bash
npm install            # instala e gera o cliente do Prisma
npm run setup          # cria/atualiza o .env.local (mostra os logins de teste uma única vez: anote)
```
Abra o `.env.local` e troque `SUA_SENHA` na linha `DATABASE_URL` pela senha do usuário `postgres`
(caracteres especiais precisam de %-encoding: `@` vira `%40`, `#` vira `%23`). Depois:

```bash
npm run db:setup       # cria as tabelas (migração), o índice anti-duplicidade e os dados iniciais
```
Para ver as tabelas: pgAdmin ou `npm run db:studio`.

## 3. Rodar
```bash
npm run dev
```
Abra http://localhost:3000 (se estiver ocupada, o Next usa 3001 e informa).

Neste computador, se `npm run dev` terminar com `spawn EPERM`, use `npm run dev:local`. Ele inicia o mesmo preview sem o processo auxiliar que o Windows está bloqueando; abra `http://localhost:3001`.

Perfis de teste: `cliente@b.com`, `barbeiro@b.com`, `admin@b.com` (senhas mostradas pelo `npm run setup`). O sistema ainda não tem recuperação ou troca de senha. Não apague `.env.local` para redefinir senhas: o seed não substitui o hash de usuários existentes.
Barbeiro novo se cadastra com **código de convite**: o dono gera em `/admin/dashboard` (uso único, expira em 72 h).
Os dados agora persistem no PostgreSQL: reiniciar o servidor não apaga nada.

## 4. Scripts
| Comando | Para quê |
|---|---|
| `npm run typecheck` | Checa os tipos (TypeScript) |
| `npm run lint` | ESLint do Next |
| `npm test` | 15 testes das regras de horário, financeiro, tenant e validação (não precisam do banco) |
| `npm run test:isolation` | Testes de integração multiempresa; exige um banco PostgreSQL separado com migrações aplicadas e nome terminado em `_test` |
| `npm run dev:local` | Preview local alternativo para este Windows quando `npm run dev` falhar com `spawn EPERM` |
| `npm run db:migrate` | Nova migração do Prisma depois de mudar `prisma/schema.prisma` |
| `npm run db:seed` | Recria serviços/horário/usuários de teste que faltarem (não altera senhas existentes) |
| `npm run db:backup` | Cria e valida um dump PostgreSQL datado em `C:\Users\Bessa\Desktop\Backup-Barbearia` |
| `npm run check:production` | Confere segredo, banco, URL HTTPS e opções perigosas antes de publicar |
| `npm run db:deploy` | Em produção: aplica migrações e o índice (use as variáveis do host) |
| `npm run prod` | Build + `next start`: **teste isto antes de publicar** (a CSP com nonce só existe em produção) |

Depois do primeiro `npm install`, guarde o `package-lock.json` e a pasta `prisma/migrations` (commit). Rode `npm audit`.

Antes de atualizar dependências, migrações ou publicar, rode `npm run db:backup`. Para salvar em outro local, defina `BACKUP_DIR` no ambiente antes de executar o comando. Se o Windows não encontrar o PostgreSQL, defina `PG_BIN` com a pasta `bin` da instalação, por exemplo `C:\Program Files\PostgreSQL\16\bin`.

Antes da primeira publicação, preencha as variáveis de produção no host e rode `npm run check:production` no próprio ambiente de hospedagem. A rota `GET /api/health` responde `{ "ok": true }` quando o aplicativo consegue falar com o banco; ela serve para monitoramento da hospedagem.

## 5. Telas já ligadas às APIs
- Cliente (`/cliente/agendar`): escolhe serviço, barbeiro, data e horário em etapas; vê e cancela agendamentos (com a antecedência configurada) e pode excluir a conta.
- Barbeiro (`/barbeiro/agenda`): agenda do dia, conclusão com forma de pagamento, faltas, cancelamento, reabertura de faltas, comissão mensal, bloqueios e fichas dos clientes atendidos.
- Dono (`/admin/dashboard`): resumo diário, caixa e relatório mensal (CSV), agenda da equipe com agendamento de balcão, clientes e observações, barbeiros, serviços, horários, convites e eventos de segurança.

As telas Next usam o mesmo tema e a mesma organização geral do `preview/barbearia.html`, mas conectam as ações às APIs autenticadas e ao PostgreSQL. O preview continua disponível como demonstração independente, com dados guardados no navegador.

## 6. O que testar
- Cliente abrindo `/admin/dashboard` vai para `/403` (3 acessos indevidos encerram a sessão).
- 6 senhas erradas bloqueiam o login por 15 min.
- Cliente tentando cancelar com menos de 2 h de antecedência recebe aviso.
- `/termos` e `/privacidade` usam os dados de `src/config/barbearia.ts`.

Leia `SECURITY.md` e `RECURSOS.md` antes de publicar.
