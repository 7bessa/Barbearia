import { NextRequest, NextResponse } from 'next/server'
import { mesSchema } from '@/lib/validation'
import { agoraBR, carregarNomes, toAg } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { calcular, movimentos } from '@/lib/financeiro'
import { audit } from '@/lib/audit'
import { erro, exigir, resp, seguro } from '@/lib/auth'

// Evita "CSV injection": células que começam com = + - @ viram texto no Excel/Sheets.
const cel = (v: string | number) => {
  const s = String(v)
  return `"${(/^[=+\-@\t\r]/.test(s) ? "'" + s : s).replace(/"/g, '""')}"`
}
const num = (n: number) => n.toFixed(2).replace('.', ',')

// Relatório mensal. Use ?mes=YYYY-MM e, opcionalmente, &formato=csv.
export const GET = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  const m = mesSchema.safeParse(req.nextUrl.searchParams.get('mes') ?? agoraBR().slice(0, 7))
  if (!m.success) return erro(400, 'Dados inválidos')
  const [rows, nomes] = await Promise.all([
    prisma.agendamento.findMany({ where: { barbeariaId: r.user.barbeariaId, data: { startsWith: m.data + '-' } } }),
    carregarNomes(r.user.barbeariaId),
  ])
  const lista = rows.map(toAg)

  if (req.nextUrl.searchParams.get('formato') === 'csv') {
    await audit(req, { acao: 'relatorio_exportado', resultado: 'ok', userId: r.user.id, detalhe: { mes: m.data } })
    const linhas = [['Data', 'Hora', 'Cliente', 'Serviço', 'Barbeiro', 'Pagamento', 'Valor', 'Comissão']]
      .concat(movimentos(lista, nomes).map((x) => [x.data, x.hora, x.cliente, x.servico, x.barbeiro, x.forma, num(x.valor), num(x.comissao)]))
      .map((l) => l.map(cel).join(';'))
    return new NextResponse('\uFEFF' + linhas.join('\r\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="relatorio-${m.data}.csv"`,
        'Cache-Control': 'no-store',
      },
    })
  }
  return resp({ mes: m.data, ...calcular(lista, nomes) })
})
