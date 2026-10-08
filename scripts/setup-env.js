// Gera .env.local com segredos aleatórios na primeira execução (npm run dev / npm run setup).
// Nunca sobrescreve um .env.local existente.
const fs = require('fs')
const path = require('path')
const { randomBytes } = require('crypto')

const alvo = path.join(__dirname, '..', '.env.local')
const DB = 'DATABASE_URL=postgresql://postgres:SUA_SENHA@localhost:5432/barbearia?schema=public'
if (fs.existsSync(alvo)) {
  // .env.local antigo (sem banco): acrescenta a linha do banco para você só trocar a senha.
  const atual = fs.readFileSync(alvo, 'utf8')
  if (!/^DATABASE_URL=/m.test(atual)) {
    fs.appendFileSync(alvo, (atual.endsWith('\n') ? '' : '\n') + DB + '\n')
    console.log('\nAdicionei DATABASE_URL ao .env.local. Troque SUA_SENHA pela senha do usuário postgres.\n')
  }
  process.exit(0)
}

const senha = (p) => `${p}${randomBytes(6).toString('base64url')}9!`
const s = { cliente: senha('Cli'), barbeiro: senha('Bar'), admin: senha('Adm') }

fs.writeFileSync(
  alvo,
  [
    '# Gerado por scripts/setup-env.js (somente DESENVOLVIMENTO). Não envie este arquivo a ninguém.',
    `JWT_SECRET=${randomBytes(48).toString('base64')}`,
    `SEED_CLIENTE_PASSWORD=${s.cliente}`,
    `SEED_BARBEIRO_PASSWORD=${s.barbeiro}`,
    `SEED_ADMIN_PASSWORD=${s.admin}`,
    '# Troque SUA_SENHA pela senha do postgres (caracteres especiais precisam de %-encoding, ex.: @ vira %40).',
    DB,
    '',
  ].join('\n'),
  { mode: 0o600 }
)

console.log('\n.env.local criado. Logins de teste (anote agora, não serão exibidos de novo):')
console.log(`  cliente@b.com   ${s.cliente}`)
console.log(`  barbeiro@b.com  ${s.barbeiro}`)
console.log(`  admin@b.com     ${s.admin}\n`)
console.log('Edite DATABASE_URL no .env.local (troque SUA_SENHA) e rode: npm run db:setup\n')
