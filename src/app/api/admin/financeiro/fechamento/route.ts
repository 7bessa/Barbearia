import { NextRequest } from 'next/server'
import { audit } from '@/lib/audit'
import { agoraBR, carregarNomes, centavos, toAg } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { caixaAbrirSchema, caixaFecharSchema, dataSchema } from '@/lib/validation'
import { calcular } from '@/lib/financeiro'
import { erro, exigir, resp, seguro } from '@/lib/auth'

const formas = ['dinheiro', 'pix', 'debito', 'credito'] as const
type Forma = typeof formas[number]
type Valores = Record<Forma, number>
const vazio = (): Valores => ({ dinheiro: 0, pix: 0, debito: 0, credito: 0 })

async function resumoFechamento(barbeariaId: number, data: string) {
  const [agendamentos, nomes, despesas, fechamento] = await Promise.all([
    prisma.agendamento.findMany({ where: { barbeariaId, data } }),
    carregarNomes(barbeariaId),
    prisma.despesa.findMany({ where: { barbeariaId, data } }),
    prisma.fechamentoCaixa.findUnique({ where: { barbeariaId_data: { barbeariaId, data } } }),
  ])
  const financeiro = calcular(agendamentos.map(toAg), nomes)
  const esperado = vazio()
  const despesasPorForma = vazio()
  for (const forma of formas) esperado[forma] = financeiro.porForma[forma] ?? 0
  for (const despesa of despesas) despesasPorForma[despesa.forma as Forma] += despesa.valorCent / 100
  esperado.dinheiro += (fechamento?.aberturaCent ?? 0) / 100
  for (const forma of formas) esperado[forma] -= despesasPorForma[forma]
  const contado: Valores | null = fechamento?.fechadoEm ? {
    dinheiro: (fechamento.contadoDinheiroCent ?? 0) / 100,
    pix: (fechamento.contadoPixCent ?? 0) / 100,
    debito: (fechamento.contadoDebitoCent ?? 0) / 100,
    credito: (fechamento.contadoCreditoCent ?? 0) / 100,
  } : null
  const diferenca = contado ? formas.reduce((total, forma) => total + contado[forma] - esperado[forma], 0) : null
  return { data, esperado, despesasPorForma, abertura: (fechamento?.aberturaCent ?? 0) / 100, fechado: !!fechamento?.fechadoEm, contado, diferenca, observacao: fechamento?.observacao ?? '', fechadoEm: fechamento?.fechadoEm?.toISOString() ?? null }
}

export const GET = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  const d = dataSchema.safeParse(req.nextUrl.searchParams.get('data') ?? agoraBR().slice(0, 10))
  if (!d.success) return erro(400, 'Data inválida')
  return resp(await resumoFechamento(r.user.barbeariaId, d.data))
})

export const POST = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  const body = await req.json().catch(() => null) as { acao?: string } | null
  if (body?.acao === 'abrir') {
    const p = caixaAbrirSchema.safeParse(body)
    if (!p.success) return erro(400, 'Confira o valor de abertura.')
    const existente = await prisma.fechamentoCaixa.findUnique({ where: { barbeariaId_data: { barbeariaId: r.user.barbeariaId, data: p.data.data } } })
    if (existente?.fechadoEm) return erro(409, 'Este caixa já foi fechado e não pode ser reaberto.')
    await prisma.fechamentoCaixa.upsert({ where: { barbeariaId_data: { barbeariaId: r.user.barbeariaId, data: p.data.data } }, create: { barbeariaId: r.user.barbeariaId, data: p.data.data, aberturaCent: centavos(p.data.abertura) }, update: { aberturaCent: centavos(p.data.abertura) } })
    await audit(req, { acao: 'caixa_aberto', resultado: 'ok', userId: r.user.id, detalhe: { data: p.data.data, abertura: centavos(p.data.abertura) } })
    return resp(await resumoFechamento(r.user.barbeariaId, p.data.data))
  }
  if (body?.acao === 'fechar') {
    const p = caixaFecharSchema.safeParse(body)
    if (!p.success) return erro(400, 'Confira os valores contados no fechamento.')
    const existente = await prisma.fechamentoCaixa.findUnique({ where: { barbeariaId_data: { barbeariaId: r.user.barbeariaId, data: p.data.data } } })
    if (existente?.fechadoEm) return erro(409, 'Este caixa já foi fechado.')
    const c = p.data.contado
    await prisma.fechamentoCaixa.upsert({ where: { barbeariaId_data: { barbeariaId: r.user.barbeariaId, data: p.data.data } }, create: { barbeariaId: r.user.barbeariaId, data: p.data.data, contadoDinheiroCent: centavos(c.dinheiro), contadoPixCent: centavos(c.pix), contadoDebitoCent: centavos(c.debito), contadoCreditoCent: centavos(c.credito), observacao: p.data.observacao ?? '', fechadoEm: new Date(), fechadoPorId: r.user.id }, update: { contadoDinheiroCent: centavos(c.dinheiro), contadoPixCent: centavos(c.pix), contadoDebitoCent: centavos(c.debito), contadoCreditoCent: centavos(c.credito), observacao: p.data.observacao ?? '', fechadoEm: new Date(), fechadoPorId: r.user.id } })
    await audit(req, { acao: 'caixa_fechado', resultado: 'ok', userId: r.user.id, detalhe: { data: p.data.data } })
    return resp(await resumoFechamento(r.user.barbeariaId, p.data.data))
  }
  return erro(400, 'Ação de caixa inválida')
})
