import type { Agendamento, Nomes } from './db'

// Dinheiro em centavos (inteiros) para não acumular erro de ponto flutuante; saída em reais.
const cent = (n: number) => Math.round(n * 100)
const reais = (c: number) => c / 100
const comissaoCent = (a: Agendamento) => Math.round((cent(a.preco) * (a.comissaoPct ?? 0)) / 100)

export function calcular(lista: Agendamento[], nomes: Nomes) {
  const nomeBarb = (id: number) => nomes.barb.get(id) ?? '—'
  const nomeServ = (id: number) => nomes.serv.get(id) ?? '—'
  const pagos = lista.filter((a) => a.status === 'concluido')
  const faltas = lista.filter((a) => a.status === 'faltou').length
  const cancelados = lista.filter((a) => a.status === 'cancelado').length
  const previsto = lista.filter((a) => a.status === 'agendado').reduce((s, a) => s + cent(a.preco), 0)

  let bruto = 0, comissoes = 0
  const forma: Record<string, number> = {}
  const barb: Record<number, { atendimentos: number; bruto: number; comissao: number }> = {}
  const serv: Record<number, { atendimentos: number; bruto: number }> = {}
  const dia: Record<string, number> = {}

  for (const a of pagos) {
    const v = cent(a.preco), cm = comissaoCent(a)
    bruto += v; comissoes += cm
    const f = a.forma ?? 'outros'
    forma[f] = (forma[f] ?? 0) + v
    const b = (barb[a.barberId] ??= { atendimentos: 0, bruto: 0, comissao: 0 })
    b.atendimentos++; b.bruto += v; b.comissao += cm
    const s = (serv[a.servicoId] ??= { atendimentos: 0, bruto: 0 })
    s.atendimentos++; s.bruto += v
    dia[a.data] = (dia[a.data] ?? 0) + v
  }

  const base = pagos.length + faltas
  return {
    atendimentos: pagos.length,
    bruto: reais(bruto),
    comissoes: reais(comissoes),
    liquido: reais(bruto - comissoes), // fica com a barbearia (antes de despesas)
    ticketMedio: pagos.length ? reais(Math.round(bruto / pagos.length)) : 0,
    previsto: reais(previsto),
    faltas, cancelados,
    taxaFalta: base ? Math.round((faltas / base) * 1000) / 10 : 0, // %
    porForma: Object.fromEntries(Object.entries(forma).map(([k, v]) => [k, reais(v)])),
    porBarbeiro: Object.entries(barb).map(([id, b]) => ({
      barberId: +id, nome: nomeBarb(+id), atendimentos: b.atendimentos, bruto: reais(b.bruto), comissao: reais(b.comissao),
    })).sort((x, y) => y.bruto - x.bruto),
    porServico: Object.entries(serv).map(([id, s]) => ({
      servicoId: +id, nome: nomeServ(+id), atendimentos: s.atendimentos, bruto: reais(s.bruto),
    })).sort((x, y) => y.bruto - x.bruto),
    porDia: Object.entries(dia).map(([data, v]) => ({ data, bruto: reais(v) })).sort((x, y) => x.data.localeCompare(y.data)),
  }
}

export const movimentos = (lista: Agendamento[], nomes: Nomes) =>
  lista
    .filter((a) => a.status === 'concluido')
    .sort((x, y) => (x.data + x.hora).localeCompare(y.data + y.hora))
    .map((a) => ({
      id: a.id, data: a.data, hora: a.hora, cliente: a.clienteNome, servico: nomes.serv.get(a.servicoId) ?? '—',
      barbeiro: nomes.barb.get(a.barberId) ?? '—', forma: a.forma ?? 'outros', valor: a.preco, comissao: reais(comissaoCent(a)),
    }))
