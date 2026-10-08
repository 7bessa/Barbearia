import { NextRequest } from 'next/server'
import { audit } from '@/lib/audit'
import { centavos } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { dataSchema, despesaSchema, idSchema } from '@/lib/validation'
import { erro, exigir, resp, seguro } from '@/lib/auth'

const paraApi = (despesa: { id: number; data: string; categoria: string; descricao: string; valorCent: number; forma: string; criadaEm: Date }) => ({
  id: despesa.id,
  data: despesa.data,
  categoria: despesa.categoria,
  descricao: despesa.descricao,
  valor: despesa.valorCent / 100,
  forma: despesa.forma,
  criadaEm: despesa.criadaEm.toISOString(),
})

// Lançamentos ficam isolados por barbearia e só o dono pode corrigir o caixa.
export const GET = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  const data = req.nextUrl.searchParams.get('data')
  if (data && !dataSchema.safeParse(data).success) return erro(400, 'Data inválida')
  const despesas = await prisma.despesa.findMany({
    where: { barbeariaId: r.user.barbeariaId, ...(data ? { data } : {}) },
    orderBy: [{ data: 'desc' }, { criadaEm: 'desc' }],
  })
  return resp({ despesas: despesas.map(paraApi) })
})

export const POST = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  const p = despesaSchema.safeParse(await req.json().catch(() => null))
  if (!p.success) return erro(400, 'Confira os dados da despesa.')
  const { valor, ...dados } = p.data
  const despesa = await prisma.despesa.create({
    data: { ...dados, valorCent: centavos(valor), barbeariaId: r.user.barbeariaId },
  })
  await audit(req, { acao: 'despesa_lancada', resultado: 'ok', userId: r.user.id, detalhe: { id: despesa.id, categoria: despesa.categoria, valor: despesa.valorCent } })
  return resp({ despesa: paraApi(despesa) }, 201)
})

export const DELETE = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  const p = idSchema.safeParse(req.nextUrl.searchParams.get('id'))
  if (!p.success) return erro(400, 'Despesa inválida')
  const despesa = await prisma.despesa.findFirst({ where: { id: p.data, barbeariaId: r.user.barbeariaId } })
  if (!despesa) return erro(404, 'Despesa não encontrada')
  await prisma.despesa.delete({ where: { id: despesa.id } })
  await audit(req, { acao: 'despesa_removida', resultado: 'ok', userId: r.user.id, detalhe: { id: despesa.id, valor: despesa.valorCent } })
  return resp({ ok: true })
})
