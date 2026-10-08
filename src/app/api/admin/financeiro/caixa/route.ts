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
  const [rows, nomes] = await Promise.all([
    prisma.agendamento.findMany({ where: { barbeariaId: r.user.barbeariaId, data: d.data } }),
    carregarNomes(r.user.barbeariaId),
  ])
  const lista = rows.map(toAg)
  return resp({ data: d.data, ...calcular(lista, nomes), movimentos: movimentos(lista, nomes) })
})
