import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { consumir } from '@/lib/rateLimit'
import { getIp } from '@/lib/audit'
import { audit } from '@/lib/audit'
import { erro, seguro, verificarCsrf } from '@/lib/auth'
import { emailPodeEnviar, emitirTokenConta, enviarLinkConta } from '@/lib/account-tokens'

const schema = z.object({ email: z.string().email().max(254).transform((v) => v.trim().toLowerCase()) })
const resposta = (linkLocal?: string) => NextResponse.json({ mensagem: 'Se esse e-mail estiver cadastrado, enviaremos instruções para redefinir a senha.', ...(linkLocal ? { linkLocal } : {}) }, { headers: { 'Cache-Control': 'no-store' } })

export const POST = seguro(async (req: NextRequest) => {
  if (!verificarCsrf(req)) return erro(403, 'Requisição inválida')
  if (!(await consumir(`recuperacao:${getIp(req)}`, 5, 60 * 60 * 1000))) return erro(429, 'Muitas tentativas. Tente novamente mais tarde.')
  const p = schema.safeParse(await req.json().catch(() => null))
  if (!p.success) return erro(400, 'Informe um e-mail válido.')
  if (!emailPodeEnviar()) return erro(503, 'O serviço de e-mail está temporariamente indisponível.')
  const usuario = await prisma.usuario.findUnique({ where: { email: p.data.email } })
  let linkLocal: string | undefined
  if (usuario && !usuario.semConta && usuario.emailVerificado) {
    try {
      const token = await emitirTokenConta(usuario.id, 'recuperacao')
      linkLocal = await enviarLinkConta(p.data.email, usuario.nome, 'recuperacao', token)
    } catch {
      await audit(req, { acao: 'recuperacao_email', resultado: 'falha', userId: usuario.id })
    }
  }
  return resposta(linkLocal)
})
