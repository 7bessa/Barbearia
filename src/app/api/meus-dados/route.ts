import { NextRequest, NextResponse } from 'next/server'
import { exclusaoSchema } from '@/lib/validation'
import { removerUsuario } from '@/lib/db'
import { audit } from '@/lib/audit'
import { destruirSessao, erro, exigir, limparCookies, seguro } from '@/lib/auth'

// LGPD (art. 18): o usuário apaga a própria conta. Admin não se apaga por aqui.
export const DELETE = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['cliente', 'barbeiro'])
  if (!r.ok) return r.res
  if (!exclusaoSchema.safeParse(await req.json().catch(() => null)).success) return erro(400, 'Dados inválidos')
  await removerUsuario(r.user.id, r.user.barbeariaId)
  await destruirSessao(r.sid)
  const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  limparCookies(res)
  await audit(req, { acao: 'conta_excluida', resultado: 'ok', userId: r.user.id })
  return res
})
