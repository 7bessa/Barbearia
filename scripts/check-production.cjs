const fs = require('node:fs')
const path = require('node:path')

const obrigatorias = [
  'DATABASE_URL', 'JWT_SECRET', 'APP_ORIGIN', 'RESEND_API_KEY', 'EMAIL_FROM',
  'MERCADO_PAGO_ACCESS_TOKEN', 'MERCADO_PAGO_WEBHOOK_SECRET',
  'MERCADO_PAGO_PLAN_ESSENCIAL_ID', 'MERCADO_PAGO_PLAN_PROFISSIONAL_ID',
]
const problemas = []

function campoLegal(config, campo) {
  const valor = config.match(new RegExp(`\\b${campo}:\\s*'([^']*)'`))?.[1]?.trim()
  return valor || ''
}

function cnpjValido(valor) {
  const digitos = valor.replace(/\D/g, '')
  if (digitos.length !== 14 || /^([0-9])\1+$/.test(digitos)) return false
  const calcular = (base, pesos) => {
    const soma = pesos.reduce((total, peso, indice) => total + Number(base[indice]) * peso, 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  const primeiro = calcular(digitos.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  const segundo = calcular(digitos.slice(0, 12) + primeiro, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2])
  return Number(digitos[12]) === primeiro && Number(digitos[13]) === segundo
}

const arquivoLegal = path.resolve(__dirname, '../src/config/barbearia.ts')
const configLegal = fs.readFileSync(arquivoLegal, 'utf8')
const identidadeLegal = {
  razaoSocial: campoLegal(configLegal, 'razaoSocial'),
  cnpj: campoLegal(configLegal, 'cnpj'),
  endereco: campoLegal(configLegal, 'endereco'),
  cidade: campoLegal(configLegal, 'cidade'),
  emailContato: campoLegal(configLegal, 'emailContato'),
  emailPrivacidade: campoLegal(configLegal, 'emailPrivacidade'),
}
if (Object.values(identidadeLegal).some((valor) => !valor || /exemplo|placeholder|seu.?dom[ií]nio|@test\b/i.test(valor))) {
  problemas.push('src/config/barbearia.ts ainda contém dados legais incompletos ou de demonstração.')
} else if (!cnpjValido(identidadeLegal.cnpj)) {
  problemas.push('O CNPJ em src/config/barbearia.ts não tem dígitos verificadores válidos.')
}
for (const campo of ['emailContato', 'emailPrivacidade']) {
  if (identidadeLegal[campo] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identidadeLegal[campo])) {
    problemas.push(`${campo} em src/config/barbearia.ts não é um e-mail válido.`)
  }
}

for (const chave of obrigatorias) {
  const valor = process.env[chave]
  if (!valor || /troque-|sua_senha|placeholder|example\.com|seudominio/i.test(valor)) problemas.push(`${chave} não foi configurada com um valor seguro.`)
}

const segredo = process.env.JWT_SECRET || ''
if (segredo.length > 0 && segredo.length < 32) problemas.push('JWT_SECRET deve ter pelo menos 32 caracteres.')
if (segredo && /^(change.?me|secret|password|test|development)/i.test(segredo)) problemas.push('JWT_SECRET parece ser um segredo de exemplo.')

const bancoUrl = process.env.DATABASE_URL || ''
try {
  const banco = new URL(bancoUrl)
  const nomeBanco = decodeURIComponent(banco.pathname.slice(1))
  if (!['postgres:', 'postgresql:'].includes(banco.protocol) || !banco.hostname || !banco.username || !banco.password || !nomeBanco) {
    problemas.push('DATABASE_URL deve conter uma URL PostgreSQL completa com usuário, senha e banco.')
  }
  if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(banco.hostname) || /(_test|example|placeholder)$/i.test(nomeBanco)) {
    problemas.push('DATABASE_URL de produção não pode apontar para localhost, banco de teste ou nome de exemplo.')
  }
} catch {
  if (bancoUrl) problemas.push('DATABASE_URL não é uma URL válida.')
}

const origem = process.env.APP_ORIGIN || ''
try {
  const url = new URL(origem)
  if (url.protocol !== 'https:' || url.origin !== origem.replace(/\/$/, '') || /(^|\.)((example|localhost|test))(\.|$)/i.test(url.hostname)) {
    problemas.push('APP_ORIGIN deve ser a origem HTTPS real do site, sem caminho ou domínio de exemplo.')
  }
} catch {
  if (origem) problemas.push('APP_ORIGIN deve ser uma origem HTTPS válida.')
}

const apiResend = process.env.RESEND_API_KEY || ''
if (apiResend && !/^re_[A-Za-z0-9_-]{16,}$/i.test(apiResend)) problemas.push('RESEND_API_KEY não tem o formato esperado de uma chave Resend.')

const remetente = process.env.EMAIL_FROM || ''
const emailRemetente = remetente.match(/<?([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})>?\s*$/i)?.[1]
if (remetente && (!emailRemetente || /(^|\.)((example|localhost|test|invalid|seudominio))(\.|$)/i.test(emailRemetente.split('@')[1] || ''))) {
  problemas.push('EMAIL_FROM deve usar um endereço real em domínio remetente configurado no Resend.')
}

const tokenMercadoPago = process.env.MERCADO_PAGO_ACCESS_TOKEN || ''
if (tokenMercadoPago && !/^APP_USR-[A-Za-z0-9_-]{20,}$/i.test(tokenMercadoPago)) {
  problemas.push('MERCADO_PAGO_ACCESS_TOKEN deve ser uma credencial de produção do Mercado Pago, não uma credencial de teste.')
}
const segredoWebhook = process.env.MERCADO_PAGO_WEBHOOK_SECRET || ''
if (segredoWebhook && segredoWebhook.length < 32) problemas.push('MERCADO_PAGO_WEBHOOK_SECRET deve ter pelo menos 32 caracteres.')
for (const chave of ['MERCADO_PAGO_PLAN_ESSENCIAL_ID', 'MERCADO_PAGO_PLAN_PROFISSIONAL_ID']) {
  const id = process.env[chave] || ''
  if (id && !/^[A-Za-z0-9_-]{8,}$/.test(id)) problemas.push(`${chave} não parece ser um identificador de plano válido.`)
}

if (process.env.TRUST_PROXY && !['0', '1'].includes(process.env.TRUST_PROXY)) problemas.push('TRUST_PROXY deve ser 0 ou 1.')
if (process.env.TRUST_PROXY !== '1') problemas.push('Defina TRUST_PROXY=1 em produção na Vercel para aplicar rate limit por IP de cliente, usando o cabeçalho encaminhado pela plataforma.')
if (process.env.ONBOARDING_PUBLICO && !['0', '1'].includes(process.env.ONBOARDING_PUBLICO)) problemas.push('ONBOARDING_PUBLICO deve ser 0 ou 1.')

if (problemas.length) {
  console.error('Configuração de produção reprovada:')
  for (const problema of problemas) console.error(`- ${problema}`)
  process.exit(1)
}

console.log('Configuração de produção aprovada.')
