const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL não foi configurada.')
  process.exit(1)
}

let banco
try {
  banco = new URL(process.env.DATABASE_URL)
} catch {
  console.error('DATABASE_URL não é uma URL PostgreSQL válida.')
  process.exit(1)
}

if (!['postgres:', 'postgresql:'].includes(banco.protocol) || !banco.pathname || banco.pathname === '/') {
  console.error('DATABASE_URL deve apontar para um banco PostgreSQL.')
  process.exit(1)
}

const nomeBanco = decodeURIComponent(banco.pathname.slice(1)).replace(/[^a-zA-Z0-9_-]/g, '_')
const destino = process.env.BACKUP_DIR || path.resolve(__dirname, '..', '..', 'Backup-Barbearia')
const data = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').replace('Z', '')
const arquivo = path.join(destino, `Backup-Barbearia-${nomeBanco}-${data}.dump`)

fs.mkdirSync(destino, { recursive: true })

// Credenciais ficam apenas no ambiente do processo, nunca expostas na lista de comandos.
const env = {
  ...process.env,
  PGHOST: banco.hostname,
  PGPORT: banco.port || '5432',
  PGUSER: decodeURIComponent(banco.username),
  PGPASSWORD: decodeURIComponent(banco.password),
  PGDATABASE: decodeURIComponent(banco.pathname.slice(1)),
}
const ssl = banco.searchParams.get('sslmode')
if (ssl) env.PGSSLMODE = ssl

const executavelPg = (nome) => {
  const arquivo = process.platform === 'win32' ? `${nome}.exe` : nome
  return process.env.PG_BIN ? path.join(process.env.PG_BIN, arquivo) : arquivo
}
const pgDump = executavelPg('pg_dump')
const pgRestore = executavelPg('pg_restore')
const dump = spawnSync(pgDump, ['--format=custom', '--no-owner', '--no-privileges', '--file', arquivo], { env, encoding: 'utf8' })

if (dump.error || dump.status !== 0) {
  console.error('Não foi possível criar o backup.')
  if (dump.error?.code === 'ENOENT') console.error('Instale o PostgreSQL ou informe a pasta bin dele em PG_BIN para encontrar pg_dump.')
  else console.error(dump.stderr || dump.error?.message || 'Erro desconhecido.')
  process.exit(1)
}

const validar = spawnSync(pgRestore, ['--list', arquivo], { env, encoding: 'utf8' })
if (validar.error || validar.status !== 0) {
  console.error('O arquivo foi criado, mas não passou na validação do PostgreSQL.')
  console.error(validar.stderr || validar.error?.message || 'Erro desconhecido.')
  process.exit(1)
}

console.log(`Backup validado: ${arquivo}`)
