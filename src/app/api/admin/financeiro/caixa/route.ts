import { NextRequest } from 'next/server'
import { dataSchema } from '@/lib/validation'
import { agoraBR, carregarNomes, toAg } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { calcular, movimentos } from '@/lib/financeiro'
import { erro, exigir, resp, seguro } from '@/lib/auth'

// Caixa do dia: total, por forma de pagamento, por barbeiro, comissões e cada movimento.
export const GET = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  const d = dataSchema.safeParse(req.nextUrl.searchParams.get('data') ?? agoraBR().slice(0, 10))
  if (!d.success) return erro(400, 'Dados inválidos')
  const [rows, nomes, despesas] = await Promise.all([
    prisma.agendamento.findMany({ where: { barbeariaId: r.user.barbeariaId, data: d.data } }),
    carregarNomes(r.user.barbeariaId),
    prisma.despesa.findMany({ where: { barbeariaId: r.user.barbeariaId, data: d.data }, orderBy: { criadaEm: 'desc' } }),
  ])
  const lista = rows.map(toAg)
  const resumo = calcular(lista, nomes)
  const totalDespesas = despesas.reduce((total, despesa) => total + despesa.valorCent / 100, 0)
  return resp({
    data: d.data,
    ...resumo,
    despesas: totalDespesas,
    saldoOperacional: resumo.liquido - totalDespesas,
    movimentos: movimentos(lista, nomes),
  })
})
