import { NextRequest } from 'next/server'
import { servicoSchema } from '@/lib/validation'
import { centavos, toServ } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/audit'
import { erro, exigir, resp, seguro } from '@/lib/auth'

export const GET = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  return resp({ servicos: (await prisma.servico.findMany({ where: { barbeariaId: r.user.barbeariaId }, orderBy: { id: 'asc' } })).map(toServ) })
})

export const POST = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  const p = servicoSchema.safeParse(await req.json().catch(() => null))
  if (!p.success) return erro(400, 'Dados inválidos')
  const s = await prisma.servico.create({ data: { barbeariaId: r.user.barbeariaId, nome: p.data.nome, precoCent: centavos(p.data.preco), dur: p.data.dur, ativo: p.data.ativo ?? true } })
  await audit(req, { acao: 'servico_criado', resultado: 'ok', userId: r.user.id, detalhe: { id: s.id } })
  return resp({ servico: toServ(s) }, 201)
})
