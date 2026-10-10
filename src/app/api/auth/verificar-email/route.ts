import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { sha256 } from '@/lib/hash'
import { erro, seguro, verificarCsrf } from '@/lib/auth'

const schema = z.object({ token: z.string().min(32).max(128) })

export const POST = seguro(async (req: NextRequest) => {
  if (!verificarCsrf(req)) return erro(403, 'Requisição inválida')
  const p = schema.safeParse(await req.json().catch(() => null))
  if (!p.success) return erro(400, 'Link de confirmação inválido ou expirado.')
  const registro = await prisma.tokenConta.findUnique({ where: { hash: sha256(p.data.token) } })
  if (!registro || registro.tipo !== 'verificacao' || registro.consumidoEm || registro.expiraEm <= new Date()) {
    return erro(400, 'Link de confirmação inválido ou expirado.')
  }
  const consumido = await prisma.$transaction(async (tx) => {
    const atualizado = await tx.tokenConta.updateMany({ where: { id: registro.id, consumidoEm: null, expiraEm: { gt: new Date() } }, data: { consumidoEm: new Date() } })
    if (atualizado.count !== 1) return false
    await tx.usuario.update({ where: { id: registro.usuarioId }, data: { emailVerificado: true } })
    return true
  })
  if (!consumido) return erro(400, 'Link de confirmação inválido ou expirado.')
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
})
