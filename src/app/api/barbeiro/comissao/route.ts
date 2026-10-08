import { NextRequest } from 'next/server'
import { mesSchema } from '@/lib/validation'
import { agoraBR, carregarNomes, toAg } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { calcular, movimentos } from '@/lib/financeiro'
import { erro, exigir, resp, seguro } from '@/lib/auth'

// O barbeiro vê apenas o que ele mesmo atendeu e a sua comissão no mês.
export const GET = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['barbeiro'])
  if (!r.ok) return r.res
  const m = mesSchema.safeParse(req.nextUrl.searchParams.get('mes') ?? agoraBR().slice(0, 7))
  if (!m.success) return erro(400, 'Dados inválidos')
  const [rows, nomes] = await Promise.all([
    prisma.agendamento.findMany({ where: { barbeariaId: r.user.barbeariaId, barberId: r.user.barberId ?? -1, data: { startsWith: m.data + '-' } } }),
    carregarNomes(r.user.barbeariaId),
  ])
  const lista = rows.map(toAg)
  const c = calcular(lista, nomes)
  return resp({
    mes: m.data, atendimentos: c.atendimentos, bruto: c.bruto, comissao: c.comissoes, faltas: c.faltas, porDia: c.porDia,
    itens: movimentos(lista, nomes).map((x) => ({ data: x.data, hora: x.hora, servico: x.servico, valor: x.valor, comissao: x.comissao })),
  })
})
