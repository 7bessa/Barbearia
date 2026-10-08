import { NextRequest } from 'next/server'
import { idSchema } from '@/lib/validation'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/audit'
import { erro, exigir, resp, seguro, tentativaIndevida } from '@/lib/auth'

export const DELETE = seguro(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id: rawId } = await ctx.params
  const r = await exigir(req, ['barbeiro', 'admin'])
  if (!r.ok) return r.res
  const id = idSchema.safeParse(rawId)
  const k = id.success ? await prisma.bloqueio.findFirst({ where: { id: id.data, barbeariaId: r.user.barbeariaId } }) : null
  // Inexistente e "de outro barbeiro" têm a mesma resposta (IDOR)
  if (!k || (r.user.role === 'barbeiro' && k.barberId !== r.user.barberId)) {
    if (k) await tentativaIndevida(r.sid, req, '/api/bloqueios')
    return erro(403, 'Acesso negado')
  }
  await prisma.bloqueio.deleteMany({ where: { id: k.id, barbeariaId: r.user.barbeariaId } })
  await audit(req, { acao: 'bloqueio_removido', resultado: 'ok', userId: r.user.id, detalhe: { id: k.id } })
  return resp({ ok: true })
})
