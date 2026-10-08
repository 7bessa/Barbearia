import { NextRequest } from 'next/server'
import { idSchema, servicoPatchSchema } from '@/lib/validation'
import { centavos, toServ } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/audit'
import { erro, exigir, resp, seguro } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

export const PATCH = seguro(async (req: NextRequest, ctx: Ctx) => {
  const { id: rawId } = await ctx.params
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  const id = idSchema.safeParse(rawId)
  const s = id.success ? await prisma.servico.findFirst({ where: { id: id.data, barbeariaId: r.user.barbeariaId } }) : null
  if (!s) return erro(404, 'Não encontrado')
  const p = servicoPatchSchema.safeParse(await req.json().catch(() => null))
  if (!p.success) return erro(400, 'Dados inválidos')
  const { preco, ...resto } = p.data // agendamentos antigos mantêm o preço/duração da época
  const novo = await prisma.servico.update({ where: { id: s.id, barbeariaId: r.user.barbeariaId }, data: { ...resto, ...(preco !== undefined ? { precoCent: centavos(preco) } : {}) } })
  await audit(req, { acao: 'servico_alterado', resultado: 'ok', userId: r.user.id, detalhe: { id: s.id } })
  return resp({ servico: toServ(novo) })
})

export const DELETE = seguro(async (req: NextRequest, ctx: Ctx) => {
  const { id: rawId } = await ctx.params
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  const id = idSchema.safeParse(rawId)
  const s = id.success ? await prisma.servico.findFirst({ where: { id: id.data, barbeariaId: r.user.barbeariaId } }) : null
  if (!s) return erro(404, 'Não encontrado')
  const usado = (await prisma.agendamento.count({ where: { barbeariaId: r.user.barbeariaId, servicoId: s.id } })) > 0
  if (usado) await prisma.servico.update({ where: { id: s.id, barbeariaId: r.user.barbeariaId }, data: { ativo: false } })
  else await prisma.servico.delete({ where: { id: s.id, barbeariaId: r.user.barbeariaId } })
  await audit(req, { acao: 'servico_removido', resultado: 'ok', userId: r.user.id, detalhe: { id: s.id, desativado: usado } })
  return resp({ ok: true, desativado: usado })
})
