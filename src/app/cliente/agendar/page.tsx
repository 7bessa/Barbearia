'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { api } from '@/lib/api-client'
import Shell, { Cartao, STATUS_TXT, botao, botaoSec, brl, campo, dataBR, hojeBR, somaDias } from '@/components/Shell'

type Catalogo = { barbeiros: { id: number; nome: string; foto: string }[]; servicos: { id: number; nome: string; preco: number; dur: number }[] }
type Ag = { id: number; data: string; hora: string; servicoId: number; barberId: number; preco: number; status: string }

const PASSOS = ['Serviço', 'Barbeiro', 'Data', 'Horário']

export default function Agendar() {
  const [cat, setCat] = useState<Catalogo | null>(null)
  const [meus, setMeus] = useState<Ag[]>([])
  const [servicoId, setServicoId] = useState('')
  const [barberId, setBarberId] = useState('')
  const [data, setData] = useState(somaDias(hojeBR(), 1))
  const [horarios, setHorarios] = useState<string[]>([])
  const [hora, setHora] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [buscandoHorarios, setBuscandoHorarios] = useState(false)
  const [passo, setPasso] = useState(1)

  const carregarMeus = useCallback(async () => {
    const r = await api<{ agendamentos: Ag[] }>('/api/agendamentos')
    if (r.ok && r.data) setMeus([...r.data.agendamentos].sort((a, b) => (b.data + b.hora).localeCompare(a.data + a.hora)))
  }, [])

  useEffect(() => {
    api<Catalogo>('/api/catalogo').then((r) => r.ok && setCat(r.data))
    carregarMeus()
  }, [carregarMeus])

  useEffect(() => {
    setHora(''); setHorarios([])
    if (!servicoId || !barberId || !data) return
    let vivo = true
    setBuscandoHorarios(true)
    api<{ horarios: string[] }>(`/api/disponibilidade?barberId=${barberId}&servicoId=${servicoId}&data=${data}`).then((r) => {
      if (vivo && r.ok && r.data) setHorarios(r.data.horarios)
    }).finally(() => { if (vivo) setBuscandoHorarios(false) })
    return () => { vivo = false }
  }, [servicoId, barberId, data])

  async function agendar() {
    setMsg(null); setOcupado(true)
    const r = await api<{ erro?: string }>('/api/agendamentos', {
      method: 'POST',
      body: JSON.stringify({ servicoId: +servicoId, barberId: +barberId, data, hora }),
    })
    setOcupado(false)
    if (!r.ok) return setMsg({ ok: false, t: r.data?.erro ?? 'Não foi possível agendar.' })
    setMsg({ ok: true, t: 'Agendamento confirmado!' })
    setHora(''); carregarMeus()
    const r2 = await api<{ horarios: string[] }>(`/api/disponibilidade?barberId=${barberId}&servicoId=${servicoId}&data=${data}`)
    if (r2.ok && r2.data) setHorarios(r2.data.horarios)
  }

  async function cancelar(id: number) {
    setMsg(null)
    const r = await api<{ erro?: string }>(`/api/agendamentos/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelado' }) })
    setMsg(r.ok ? { ok: true, t: 'Agendamento cancelado.' } : { ok: false, t: r.data?.erro ?? 'Não foi possível cancelar.' })
    carregarMeus()
  }

  async function excluirConta() {
    if (!confirm('Excluir sua conta e seus dados pessoais? Esta ação não pode ser desfeita.')) return
    const r = await api('/api/meus-dados', { method: 'DELETE', body: JSON.stringify({ confirmar: true }) })
    if (r.ok) window.location.href = '/'
    else setMsg({ ok: false, t: 'Não foi possível excluir a conta.' })
  }

  const nomeS = (id: number) => cat?.servicos.find((s) => s.id === id)?.nome ?? '—'
  const nomeB = (id: number) => cat?.barbeiros.find((b) => b.id === id)?.nome ?? '—'
  const hoje = hojeBR()
  const datas = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const valor = somaDias(hoje, i)
    const d = new Date(`${valor}T12:00:00Z`)
    return { valor, dia: d.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace('.', ''), numero: d.getUTCDate(), mes: d.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '') }
  }), [hoje])

  const proximo = () => setPasso((n) => Math.min(4, n + 1))
  const anterior = () => setPasso((n) => Math.max(1, n - 1))
  const podeAvancar = (passo === 1 && !!servicoId) || (passo === 2 && !!barberId) || (passo === 3 && !!data)

  return (
    <Shell titulo="Agendar horário">
      <Cartao titulo="Novo agendamento">
        <div className="stepper" aria-label={`Etapa ${passo} de 4`}>
          {PASSOS.map((label, i) => <div key={label} className={`step${i + 1 === passo ? ' is-current' : ''}${i + 1 < passo ? ' is-done' : ''}`}><span className="step-index">{i + 1 < passo ? '✓' : i + 1}</span><span>{label}</span></div>)}
        </div>

        {passo === 1 && <div className="choice-grid">
          {cat?.servicos.map((s) => <button key={s.id} type="button" className="choice-card" aria-pressed={servicoId === String(s.id)} onClick={() => { setServicoId(String(s.id)); setPasso(2) }}>
            <span className="choice-title">{s.nome}</span><span className="choice-detail">{s.dur} minutos</span><span className="choice-price">{brl(s.preco)}</span>
          </button>)}
          {cat && cat.servicos.length === 0 && <p className="empty-state">Ainda não há serviços disponíveis.</p>}
        </div>}

        {passo === 2 && <div className="choice-grid">
          {cat?.barbeiros.map((b) => <button key={b.id} type="button" className="choice-card" aria-pressed={barberId === String(b.id)} onClick={() => { setBarberId(String(b.id)); setPasso(3) }}>
            <span className="barber-choice">{b.foto ? <Image className="barber-choice-photo" src={b.foto} alt={`Foto de ${b.nome}`} width={48} height={48} unoptimized /> : <span className="barber-photo-fallback" aria-hidden="true">{b.nome.slice(0, 1)}</span>}<span className="barber-choice-copy"><span className="choice-title">{b.nome}</span><span className="choice-detail">Profissional da equipe</span></span></span>
          </button>)}
          {cat && cat.barbeiros.length === 0 && <p className="empty-state">Ainda não há profissionais disponíveis.</p>}
        </div>}

        {passo === 3 && <div className="date-strip" aria-label="Escolha a data">
          {datas.map((d, i) => <button key={d.valor} className="date-choice" type="button" aria-pressed={data === d.valor} onClick={() => setData(d.valor)}><small>{i === 0 ? 'Hoje' : d.dia}</small><strong>{d.numero}</strong><small>{d.mes}</small></button>)}
        </div>}

        {passo === 4 && <>
          <div className="booking-summary"><div><span className="muted">Serviço</span><strong>{cat?.servicos.find((s) => String(s.id) === servicoId)?.nome}</strong></div><div><span className="muted">Profissional</span><strong>{nomeB(+barberId)}</strong></div><div><span className="muted">Data</span><strong>{dataBR(data)}</strong></div></div>
          {buscandoHorarios ? <p className="muted">Buscando horários livres...</p> : horarios.length ? <div className="time-grid" aria-label="Horários disponíveis">{horarios.map((h) => <button key={h} type="button" className="time-choice" aria-pressed={hora === h} onClick={() => setHora(h)}>{h}</button>)}</div> : <p className="empty-state">Sem horários livres nesta data. Volte e escolha outro dia.</p>}
        </>}

        <div className="inline-row booking-actions">
          {passo > 1 && <button type="button" className={botaoSec} onClick={anterior}>Voltar</button>}
          {passo < 4 && <button type="button" className={botao} disabled={!podeAvancar} onClick={proximo}>Continuar</button>}
          {passo === 4 && <button type="button" className={botao} disabled={!hora || ocupado} onClick={agendar}>{ocupado ? 'Confirmando...' : `Confirmar às ${hora || '--:--'}`}</button>}
        </div>
        {msg && <p className={msg.ok ? 'success' : 'error'} role="status">{msg.t}</p>}
      </Cartao>

      <Cartao titulo="Meus agendamentos">
        {meus.length === 0 ? <p className="empty-state">Nenhum agendamento ainda.</p> : meus.map((a) => (
          <div key={a.id} className="list-row">
            <div className="list-main"><p className="list-title">{dataBR(a.data)} às {a.hora} · {nomeS(a.servicoId)}</p><p className="list-meta">{nomeB(a.barberId)} · {brl(a.preco)}</p></div>
            <div className="inline-row"><span className="status-tag" data-status={a.status}>{STATUS_TXT[a.status] ?? a.status}</span>{a.status === 'agendado' && a.data >= hoje && <button className="button button-danger" onClick={() => cancelar(a.id)}>Cancelar</button>}</div>
          </div>
        ))}
      </Cartao>

      <div className="inline-row customer-links">
        <Link href="/termos" className="link-muted">Termos</Link><Link href="/privacidade" className="link-muted">Privacidade</Link>
        <button onClick={excluirConta} className="link-muted account-delete">Excluir minha conta</button>
      </div>
    </Shell>
  )
}
