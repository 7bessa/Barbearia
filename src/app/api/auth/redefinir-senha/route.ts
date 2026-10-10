import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { hashSenha, sha256 } from '@/lib/hash'
import { erro, seguro, verificarCsrf } from '@/lib/auth'

const schema = z.object({
  token: z.string().min(32).max(128),
  senha: z.string().min(8).max(72).regex(/[A-Za-z]/).regex(/\d/),
})

export const POST = seguro(async (req: NextRequest) => {
  if (!verificarCsrf(req)) return erro(403, 'Requisição inválida')
  const p = schema.safeParse(await req.json().catch(() => null))
  if (!p.success) return erro(400, 'Use uma senha com ao menos 8 caracteres, incluindo letra e número.')
  const registro = await prisma.tokenConta.findUnique({ where: { hash: sha256(p.data.token) } })
  if (!registro || registro.tipo !== 'recuperacao' || registro.consumidoEm || registro.expiraEm <= new Date()) {
    return erro(400, 'Link de recuperação inválido ou expirado.')
  }
  const senhaHash = await hashSenha(p.data.senha)
  const sucesso = await prisma.$transaction(async (tx) => {
    const atualizado = await tx.tokenConta.updateMany({ where: { id: registro.id, consumidoEm: null, expiraEm: { gt: new Date() } }, data: { consumidoEm: new Date() } })
    if (atualizado.count !== 1) return false
    await tx.usuario.update({ where: { id: registro.usuarioId }, data: { senhaHash } })
    await tx.sessao.deleteMany({ where: { userId: registro.usuarioId } })
    return true
  })
  if (!sucesso) return erro(400, 'Link de recuperação inválido ou expirado.')
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
})
