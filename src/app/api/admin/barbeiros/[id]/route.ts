import { NextRequest } from 'next/server'
import { barbeiroPatchSchema, idSchema } from '@/lib/validation'
import { toBarb } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/audit'
import { erro, exigir, resp, seguro } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = seguro(async (req: NextRequest, ctx: Ctx) => {
  const { id: rawId } = await ctx.params
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  const id = idSchema.safeParse(rawId)
  const b = id.success ? await prisma.barbeiro.findFirst({ where: { id: id.data, barbeariaId: r.user.barbeariaId } }) : null
  if (!b) return erro(404, 'Não encontrado')
  const p = barbeiroPatchSchema.safeParse(await req.json().catch(() => null))
  if (!p.success) return erro(400, 'Dados inválidos')
  // a comissão nova vale só para atendimentos futuros (os antigos têm snapshot)
  const novo = await prisma.$transaction(async (tx) => {
    const atualizado = await tx.barbeiro.update({ where: { id: b.id, barbeariaId: r.user.barbeariaId }, data: p.data })
    if (p.data.ativo === false) {
      const usuarios = await tx.usuario.findMany({ where: { barbeariaId: r.user.barbeariaId, barberId: b.id }, select: { id: true } })
      if (usuarios.length) await tx.sessao.deleteMany({ where: { userId: { in: usuarios.map((u) => u.id) } } })
    }
    return atualizado
  })
  await audit(req, { acao: 'barbeiro_alterado', resultado: 'ok', userId: r.user.id, detalhe: { id: b.id } })
  return resp({ barbeiro: toBarb(novo) })
})

// Com histórico ou login vinculado, apenas desativa (preserva financeiro). Senão, remove.
export const DELETE = seguro(async (req: NextRequest, ctx: Ctx) => {
  const { id: rawId } = await ctx.params
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  const id = idSchema.safeParse(rawId)
  const b = id.success ? await prisma.barbeiro.findFirst({ where: { id: id.data, barbeariaId: r.user.barbeariaId } }) : null
  if (!b) return erro(404, 'Não encontrado')
  const [ags, logins] = await Promise.all([
    prisma.agendamento.count({ where: { barbeariaId: r.user.barbeariaId, barberId: b.id } }),
    prisma.usuario.count({ where: { barbeariaId: r.user.barbeariaId, barberId: b.id } }),
  ])
  const preservar = ags > 0 || logins > 0
  if (preservar) {
    await prisma.$transaction(async (tx) => {
      await tx.barbeiro.update({ where: { id: b.id, barbeariaId: r.user.barbeariaId }, data: { ativo: false } })
      const usuarios = await tx.usuario.findMany({ where: { barbeariaId: r.user.barbeariaId, barberId: b.id }, select: { id: true } })
      if (usuarios.length) await tx.sessao.deleteMany({ where: { userId: { in: usuarios.map((u) => u.id) } } })
    })
  } else await prisma.barbeiro.delete({ where: { id: b.id, barbeariaId: r.user.barbeariaId } })
  await audit(req, { acao: 'barbeiro_removido', resultado: 'ok', userId: r.user.id, detalhe: { id: b.id, desativado: preservar } })
  return resp({ ok: true, desativado: preservar })
})
