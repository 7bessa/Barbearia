'use client'
import { useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Cartao, Kpi, brl, campo, dataBR, hojeBR } from '@/components/Shell'

type Relatorio = {
  mes: string; atendimentos: number; bruto: number; comissoes: number; liquido: number; despesas: number; saldoOperacional: number; ticketMedio: number
  porBarbeiro: { barberId: number; nome: string; atendimentos: number; bruto: number; comissao: number }[]
  porServico: { servicoId: number; nome: string; atendimentos: number; bruto: number }[]
  clientesSumidos: { id: number; nome: string; telefone: string; ultimaVisita: string | null }[]
  estoqueBaixo: { id: number; nome: string; quantidade: number; estoqueMinimo: number }[]
}

export default function AdminRelatorios() {
  const [mes, setMes] = useState(hojeBR().slice(0, 7))
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null)
  const carregar = useCallback(async () => { const r = await api<Relatorio>(`/api/admin/relatorios?mes=${mes}`); if (r.ok && r.data) setRelatorio(r.data) }, [mes])
  useEffect(() => { carregar() }, [carregar])
  return <Cartao titulo="Relatórios de gestão">
    <label className="inline-row muted">Período<input className={campo} type="month" value={mes} onChange={(e) => setMes(e.target.value)} /></label>
    {!relatorio ? <p className="muted">Carregando relatórios...</p> : <>
      <div className="grid-cards"><Kpi titulo="Faturamento" valor={brl(relatorio.bruto)} /><Kpi titulo="Ticket médio" valor={brl(relatorio.ticketMedio)} /><Kpi titulo="Despesas" valor={brl(relatorio.despesas)} /><Kpi titulo="Resultado após despesas" valor={brl(relatorio.saldoOperacional)} /></div>
      <h3>Ranking da equipe</h3><div className="table-wrap"><table className="data-table"><thead><tr><th>Profissional</th><th>Atendimentos</th><th>Faturamento</th><th>Comissão</th></tr></thead><tbody>{relatorio.porBarbeiro.map((item) => <tr key={item.barberId}><td>{item.nome}</td><td>{item.atendimentos}</td><td>{brl(item.bruto)}</td><td>{brl(item.comissao)}</td></tr>)}{relatorio.porBarbeiro.length === 0 && <tr><td colSpan={4} className="muted">Nenhum atendimento concluído neste período.</td></tr>}</tbody></table></div>
      <h3>Serviços mais vendidos</h3><div className="table-wrap"><table className="data-table"><thead><tr><th>Serviço</th><th>Atendimentos</th><th>Faturamento</th></tr></thead><tbody>{relatorio.porServico.map((item) => <tr key={item.servicoId}><td>{item.nome}</td><td>{item.atendimentos}</td><td>{brl(item.bruto)}</td></tr>)}{relatorio.porServico.length === 0 && <tr><td colSpan={3} className="muted">Ainda não há vendas neste período.</td></tr>}</tbody></table></div>
      <h3>Clientes há mais de 45 dias sem voltar</h3>{relatorio.clientesSumidos.length === 0 ? <p className="empty-state">Nenhum cliente inativo encontrado.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Cliente</th><th>Telefone</th><th>Última visita</th></tr></thead><tbody>{relatorio.clientesSumidos.map((item) => <tr key={item.id}><td>{item.nome}</td><td>{item.telefone}</td><td>{item.ultimaVisita ? dataBR(item.ultimaVisita) : '—'}</td></tr>)}</tbody></table></div>}
      <h3>Estoque para repor</h3>{relatorio.estoqueBaixo.length === 0 ? <p className="empty-state">Nenhum produto abaixo do estoque mínimo.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Produto</th><th>Disponível</th><th>Mínimo</th></tr></thead><tbody>{relatorio.estoqueBaixo.map((item) => <tr key={item.id}><td>{item.nome}</td><td>{item.quantidade}</td><td>{item.estoqueMinimo}</td></tr>)}</tbody></table></div>}
    </>}
  </Cartao>
}
