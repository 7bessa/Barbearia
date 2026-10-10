import { randomBytes } from 'crypto'
import { prisma } from './prisma'
import { sha256 } from './hash'
import { enviarEmailConta } from './email'

export type TipoTokenConta = 'verificacao' | 'recuperacao'

export function emailPodeEnviar() {
  return process.env.NODE_ENV !== 'production' || Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM && process.env.APP_ORIGIN)
}

export async function emitirTokenConta(usuarioId: number, tipo: TipoTokenConta) {
  const token = randomBytes(32).toString('base64url')
  const expiraEm = new Date(Date.now() + (tipo === 'verificacao' ? 24 : 1) * 60 * 60 * 1000)
  await prisma.$transaction([
    prisma.tokenConta.deleteMany({ where: { usuarioId, tipo, consumidoEm: null } }),
    prisma.tokenConta.create({ data: { hash: sha256(token), usuarioId, tipo, expiraEm } }),
  ])
  return token
}

export async function enviarLinkConta(email: string, nome: string, tipo: TipoTokenConta, token: string) {
  const origem = (process.env.APP_ORIGIN || 'http://localhost:3000').replace(/\/$/, '')
  const pagina = tipo === 'verificacao' ? '/verificar-email' : '/redefinir-senha'
  const url = `${origem}${pagina}?token=${encodeURIComponent(token)}`
  const assunto = tipo === 'verificacao' ? 'Confirme seu e-mail' : 'Redefina sua senha'
  const acao = tipo === 'verificacao' ? 'Confirmar meu e-mail' : 'Escolher nova senha'
  const limite = tipo === 'verificacao' ? 'Este link expira em 24 horas.' : 'Este link expira em 1 hora.'
  await enviarEmailConta({ to: email, nome, assunto, acao, limite, url })
  return process.env.NODE_ENV === 'production' ? undefined : url
}
