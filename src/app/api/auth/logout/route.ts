import { NextRequest, NextResponse } from 'next/server'
import { audit } from '@/lib/audit'
import { destruirSessao, erro, lerRtSid, lerSessao, limparCookies, seguro, verificarCsrf } from '@/lib/auth'

export const POST = seguro(async (req: NextRequest) => {
  if (!verificarCsrf(req)) return erro(403, 'Requisição inválida')
  const s = await lerSessao(req)
  await destruirSessao(s?.sid ?? lerRtSid(req)) // invalida no servidor, não só no cookie
  const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  limparCookies(res)
  await audit(req, { acao: 'logout', resultado: 'ok', userId: s?.user.id })
  return res
})
