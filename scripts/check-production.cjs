const obrigatorias = ['DATABASE_URL', 'JWT_SECRET', 'APP_ORIGIN']
const problemas = []

for (const chave of obrigatorias) {
  const valor = process.env[chave]
  if (!valor || /troque-|sua_senha/i.test(valor)) problemas.push(`${chave} não foi configurada com um valor seguro.`)
}

const segredo = process.env.JWT_SECRET || ''
if (segredo.length > 0 && segredo.length < 32) problemas.push('JWT_SECRET deve ter pelo menos 32 caracteres.')

const origem = process.env.APP_ORIGIN || ''
if (origem && !/^https:\/\/[^\s/]+/i.test(origem)) problemas.push('APP_ORIGIN de produção deve usar HTTPS, por exemplo https://app.seudominio.com.br.')

if (process.env.TRUST_PROXY && !['0', '1'].includes(process.env.TRUST_PROXY)) problemas.push('TRUST_PROXY deve ser 0 ou 1.')
if (process.env.ONBOARDING_PUBLICO === '1') problemas.push('ONBOARDING_PUBLICO=1 só deve ser usado depois de configurar confirmação de e-mail e proteção antiabuso.')

if (problemas.length) {
  console.error('Configuração de produção reprovada:')
  for (const problema of problemas) console.error(`- ${problema}`)
  process.exit(1)
}

console.log('Configuração de produção aprovada.')
