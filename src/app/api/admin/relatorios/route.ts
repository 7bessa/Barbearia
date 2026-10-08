import { NextRequest } from 'next/server'
import { agoraBR, carregarNomes, toAg } from '@/lib/db'
import { calcular } from '@/lib/financeiro'
import { prisma } from '@/lib/prisma'
import { mesSchema } from '@/lib/validation'
import { erro, exigir, resp, seguro } from '@/lib/auth'

const diasAntes = (n: number) => new Date(Date.now() - n * 86400000).toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })

export const GET = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  const mes = mesSchema.safeParse(req.nextUrl.searchParams.get('mes') ?? agoraBR().slice(0, 7))
  if (!mes.success) return erro(400, 'Mês inválido')
  const [agendamentos, nomes, despesas, clientes, ultimos, produtos] = await Promise.all([
    prisma.agendamento.findMany({ where: { barbeariaId: r.user.barbeariaId, data: { startsWith: mes.data + '-' } } }),
    carregarNomes(r.user.barbeariaId),
    prisma.despesa.findMany({ where: { barbeariaId: r.user.barbeariaId, data: { startsWith: mes.data + '-' } } }),
    prisma.usuario.findMany({ where: { barbeariaId: r.user.barbeariaId, role: 'cliente', semConta: false }, select: { id: true, nome: true, telefone: true } }),
    prisma.agendamento.findMany({ where: { barbeariaId: r.user.barbeariaId, clienteId: { not: null }, status: 'concluido' }, select: { clienteId: true, data: true }, orderBy: { data: 'desc' } }),
    prisma.produto.findMany({ where: { barbeariaId: r.user.barbeariaId, ativo: true }, select: { id: true, nome: true, quantidade: true, estoqueMinimo: true }, orderBy: { quantidade: 'asc' } }),
  ])
  const financeiro = calcular(agendamentos.map(toAg), nomes)
  const totalDespesas = despesas.reduce((total, item) => total + item.valorCent / 100, 0)
  const ultimaVisita = new Map<number, string>()
  for (const item of ultimos) if (item.clienteId && !ultimaVisita.has(item.clienteId)) ultimaVisita.set(item.clienteId, item.data)
  const limiteInatividade = diasAntes(45)
  const clientesSumidos = clientes
    .map((cliente) => ({ ...cliente, ultimaVisita: ultimaVisita.get(cliente.id) ?? null }))
    .filter((cliente) => cliente.ultimaVisita !== null && cliente.ultimaVisita < limiteInatividade)
    .sort((a, b) => (a.ultimaVisita ?? '').localeCompare(b.ultimaVisita ?? ''))
    .slice(0, 20)
  return resp({
    mes: mes.data,
    ...financeiro,
    despesas: totalDespesas,
    saldoOperacional: financeiro.liquido - totalDespesas,
    clientesSumidos,
    estoqueBaixo: produtos.filter((produto) => produto.quantidade <= produto.estoqueMinimo),
  })
})
