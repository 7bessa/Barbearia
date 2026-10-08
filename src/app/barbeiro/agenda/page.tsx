'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api-client'
import Shell, { Cartao, Kpi, STATUS_TXT, botao, botaoSec, brl, campo, dataBR, hojeBR, somaDias } from '@/components/Shell'
import { BarbeiroBloqueios, BarbeiroClientes, ListaEspera } from '@/components/AdminAreas'

type Catalogo = { barbeiros: { id: number; nome: string }[]; servicos: { id: number; nome: string }[] }
type Ag = { id: number; data: string; hora: string; servicoId: number; dur: number; preco: number; status: string; clienteNome?: string; clienteTel?: string; forma?: string | null }
type Comissao = { mes: string; atendimentos: number; bruto: number; comissao: number; faltas: number; itens?: { data: string; hora: string; servico: string; valor: number; comissao: number }[] }
const FORMAS = [['pix', 'Pix'], ['dinheiro', 'Dinheiro'], ['debito', 'Débito'], ['credito', 'Crédito']] as const

export default function Agenda() {
  const [visao, setVisao] = useState<'agenda' | 'comissao' | 'bloqueios' | 'clientes'>('agenda')
  const [dia, setDia] = useState(hojeBR())
  const [lista, setLista] = useState<Ag[]>([])
  const [cat, setCat] = useState<Catalogo | null>(null)
  const [com, setCom] = useState<Comissao | null>(null)
  const [baixa, setBaixa] = useState<number | null>(null)
  const [forma, setForma] = useState('pix')
  const [msg, setMsg] = useState('')

  const carregar = useCallback(async () => {
    const [a, c] = await Promise.all([
      api<{ agendamentos: Ag[] }>('/api/agendamentos'),
      api<Comissao>('/api/barbeiro/comissao'),
    ])
    if (a.ok && a.data) setLista(a.data.agendamentos)
    if (c.ok && c.data) setCom(c.data)
  }, [])

  useEffect(() => {
    api<Catalogo>('/api/catalogo').then((r) => r.ok && setCat(r.data))
    carregar()
  }, [carregar])

  useEffect(() => {
    const sincronizarVisao = () => {
      const view = window.location.hash.slice(1)
      setVisao(view === 'comissao' || view === 'bloqueios' || view === 'clientes' ? view : 'agenda')
    }
    sincronizarVisao()
    window.addEventListener('hashchange', sincronizarVisao)
    return () => window.removeEventListener('hashchange', sincronizarVisao)
  }, [])

  async function mudar(id: number, status: string, formaPagamento?: string) {
    setMsg('')
    const r = await api<{ erro?: string }>(`/api/agendamentos/${id}`, { method: 'PATCH', body: JSON.stringify({ status, formaPagamento }) })
    if (!r.ok) setMsg(r.data?.erro ?? 'Não foi possível atualizar.')
    setBaixa(null)
    carregar()
  }

  const doDia = useMemo(() => lista.filter((a) => a.data === dia).sort((a, b) => a.hora.localeCompare(b.hora)), [lista, dia])
  const nomeS = (id: number) => cat?.servicos.find((s) => s.id === id)?.nome ?? '—'
  const agendados = doDia.filter((a) => a.status === 'agendado').length
  const realizados = doDia.filter((a) => a.status === 'concluido').length

  return (
    <Shell titulo="Minha agenda">
      {visao === 'agenda' && <>
        <div className="grid-cards">
          <Kpi titulo="Atendimentos do dia" valor={String(doDia.length)} detalhe={dataBR(dia)} />
          <Kpi titulo="Aguardando atendimento" valor={String(agendados)} />
          <Kpi titulo="Concluídos" valor={String(realizados)} detalhe={brl(doDia.filter((a) => a.status === 'concluido').reduce((s, a) => s + a.preco, 0))} />
        </div>
        <Cartao titulo="Agenda do dia">
          <div className="inline-row agenda-controls"><button aria-label="Dia anterior" className={botaoSec} onClick={() => setDia(somaDias(dia, -1))}>←</button><input className={campo} type="date" value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} /><button aria-label="Próximo dia" className={botaoSec} onClick={() => setDia(somaDias(dia, 1))}>→</button><button className={botaoSec} onClick={() => setDia(hojeBR())}>Hoje</button><span className="muted">{doDia.length} atendimento(s)</span></div>
          {msg && <p className="error" role="alert">{msg}</p>}
          {doDia.length === 0 ? <p className="empty-state">Nenhum atendimento neste dia.</p> : doDia.map((a) => (
            <div key={a.id} className={`appointment-row${a.status === 'concluido' ? ' is-complete' : a.status === 'cancelado' || a.status === 'faltou' ? ' is-closed' : ''}`}>
              <div className="appointment-time"><strong>{a.hora}</strong><span>{a.dur} min</span></div>
              <div className="appointment-main"><div className="inline-row"><strong>{a.clienteNome || 'Cliente'}</strong><span className="status-tag" data-status={a.status}>{STATUS_TXT[a.status] ?? a.status}</span></div>
                <p className="list-meta">{nomeS(a.servicoId)} · {brl(a.preco)}{a.forma ? ` · ${a.forma}` : ''}</p>
                {a.clienteTel && <a className="phone-link" href={`tel:${a.clienteTel.replace(/[^+\d]/g, '')}`}>{a.clienteTel}</a>}
                {a.status === 'agendado' && (baixa === a.id ? <div className="inline-row appointment-actions"><select className={campo} aria-label="Forma de pagamento" value={forma} onChange={(e) => setForma(e.target.value)}>{FORMAS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select><button className={botao} onClick={() => mudar(a.id, 'concluido', forma)}>Confirmar pagamento</button><button className={botaoSec} onClick={() => setBaixa(null)}>Voltar</button></div> : <div className="inline-row appointment-actions"><button className={botao} onClick={() => setBaixa(a.id)}>Concluir atendimento</button><button className={botaoSec} onClick={() => mudar(a.id, 'faltou')}>Marcar falta</button><button className="button button-danger" onClick={() => confirm('Cancelar este atendimento?') && mudar(a.id, 'cancelado')}>Cancelar</button></div>)}
                {a.status === 'faltou' && <button className={botaoSec} onClick={() => mudar(a.id, 'agendado')}>Reabrir atendimento</button>}
              </div>
            </div>
          ))}
        </Cartao>
        <ListaEspera catalogo={cat} />
      </>}
      {visao === 'comissao' && <Cartao id="comissao" titulo={`Minha comissão · ${com?.mes.split('-').reverse().join('/') ?? ''}`}>
        {com ? <><div className="grid-cards"><Kpi titulo="Atendimentos" valor={String(com.atendimentos)} /><Kpi titulo="Faturado" valor={brl(com.bruto)} /><Kpi titulo="Sua comissão" valor={brl(com.comissao)} /><Kpi titulo="Faltas" valor={String(com.faltas)} /></div>
          {com.itens?.map((a, i) => <div key={`${a.data}-${a.hora}-${i}`} className="list-row"><div className="list-main"><p className="list-title">{dataBR(a.data)} · {a.hora} · {a.servico}</p><p className="list-meta">{brl(a.valor)} faturados</p></div><span className="status-tag" data-status="concluido">Comissão {brl(a.comissao)}</span></div>)}</> : <p className="muted">Carregando comissão...</p>}
      </Cartao>}
      {visao === 'bloqueios' && <BarbeiroBloqueios />}
      {visao === 'clientes' && <BarbeiroClientes />}
    </Shell>
  )
}
