import { NextRequest } from 'next/server'
import { horariosLivres } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { dataSchema, idSchema } from '@/lib/validation'
import { slugValido } from '@/lib/slug-barbearia'
import { consumir } from '@/lib/rateLimit'
import { getIp } from '@/lib/audit'
import { erro, resp, seguro } from '@/lib/auth'

type Contexto = { params: Promise<{ slug: string }> }

export const GET = seguro(async (req: NextRequest, ctx: Contexto) => {
  const { slug } = await ctx.params
  if (!slugValido(slug)) return erro(404, 'Barbearia não encontrada')
  const barbearia = await prisma.barbearia.findUnique({ where: { slug }, select: { id: true, ativa: true } })
  if (!barbearia?.ativa) return erro(404, 'Barbearia não encontrada')
  if (!(await consumir(`publico-disponibilidade:${barbearia.id}:${getIp(req)}`, 300, 60 * 60 * 1000))) {
    return erro(429, 'Muitas consultas. Aguarde um pouco e tente novamente.')
  }
  const q = req.nextUrl.searchParams
  const barberId = idSchema.safeParse(q.get('barberId'))
  const servicoId = idSchema.safeParse(q.get('servicoId'))
  const data = dataSchema.safeParse(q.get('data'))
  if (!barberId.success || !servicoId.success || !data.success) return erro(400, 'Dados inválidos')
  const [barbeiro, servico] = await Promise.all([
    prisma.barbeiro.findFirst({ where: { id: barberId.data, barbeariaId: barbearia.id, ativo: true } }),
    prisma.servico.findFirst({ where: { id: servicoId.data, barbeariaId: barbearia.id, ativo: true } }),
  ])
  if (!barbeiro || !servico) return erro(400, 'Dados inválidos')
  return resp({ horarios: await horariosLivres(barbearia.id, barbeiro.id, data.data, servico.dur) })
})

export const dynamic = 'force-dynamic'
