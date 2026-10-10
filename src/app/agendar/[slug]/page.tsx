'use client'
import Link from 'next/link'
import Image from 'next/image'
import { use, useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { api } from '@/lib/api-client'
import { botao, botaoSec, brl, hojeBR, somaDias, dataBR } from '@/components/Shell'

type Catalogo = {
  barbearia: { id: number; nome: string; slug: string; slogan: string; logo: string; corPrimaria: string; corFundo: string }
  barbeiros: { id: number; nome: string; foto: string }[]
  servicos: { id: number; nome: string; preco: number; dur: number }[]
}
type Confirmacao = { id: number; data: string; hora: string; preco: number }
const PASSOS = ['Serviço', 'Profissional', 'Data e horário', 'Seus dados']

function corSegura(valor: string | undefined, reserva: string) {
  return valor && /^#[\da-f]{6}$/i.test(valor) ? valor : reserva
}
function corDeContraste(hex: string) {
  const [r, g, b] = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((parte) => Number.parseInt(parte, 16))
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#17130a' : '#ffffff'
}

export default function AgendarPublico({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params)
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
  const [erroCarregar, setErroCarregar] = useState<'nao-encontrada' | 'indisponivel' | ''>('')
  const [tentativa, setTentativa] = useState(0)
  const [servicoId, setServicoId] = useState('')
  const [barberId, setBarberId] = useState('')
  const [data, setData] = useState(somaDias(hojeBR(), 1))
  const [horarios, setHorarios] = useState<string[]>([])
  const [diaFechado, setDiaFechado] = useState(false)
  const [erroHorarios, setErroHorarios] = useState(false)
  const [hora, setHora] = useState('')
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [aceitoTermos, setAceitoTermos] = useState(false)
  const [passo, setPasso] = useState(1)
  const [carregandoHorarios, setCarregandoHorarios] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null)
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null)
  const hoje = hojeBR()
  const datas = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const valor = somaDias(hoje, i + 1)
    const d = new Date(`${valor}T12:00:00Z`)
    return { valor, dia: d.toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace('.', ''), numero: d.getUTCDate(), mes: d.toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '') }
  }), [hoje])

  useEffect(() => {
    let ativo = true
    api<Catalogo & { erro?: string }>(`/api/publico/${encodeURIComponent(slug)}`).then((r) => {
      if (!ativo) return
      if (r.ok && r.data) setCatalogo(r.data)
      else setErroCarregar(r.status === 404 ? 'nao-encontrada' : 'indisponivel')
    }).catch(() => { if (ativo) setErroCarregar('indisponivel') })
    return () => { ativo = false }
  }, [slug, tentativa])

  const buscarHorarios = useCallback(async () => {
    if (!servicoId || !barberId || !data) return
    setCarregandoHorarios(true)
    setErroHorarios(false)
    setDiaFechado(false)
    const qs = new URLSearchParams({ barberId, servicoId, data })
    try {
      const r = await api<{ horarios: string[]; fechado: boolean }>(`/api/publico/${encodeURIComponent(slug)}/disponibilidade?${qs}`)
      if (!r.ok || !r.data) throw new Error('Falha ao consultar disponibilidade')
      setHorarios(r.data.horarios)
      setDiaFechado(r.data.fechado)
    } catch {
      setHorarios([])
      setErroHorarios(true)
    } finally {
      setCarregandoHorarios(false)
    }
  }, [barberId, data, slug, servicoId])

  useEffect(() => {
    setHora('')
    void buscarHorarios()
  }, [buscarHorarios])

  async function confirmar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMensagem(null)
    setEnviando(true)
    try {
      const r = await api<{ erro?: string; agendamento?: Confirmacao }>(`/api/publico/${encodeURIComponent(slug)}`, {
        method: 'POST',
        body: JSON.stringify({ servicoId: +servicoId, barberId: +barberId, data, hora, nome, telefone, aceitoTermos }),
      })
      if (!r.ok || !r.data?.agendamento) return setMensagem({ ok: false, texto: r.data?.erro ?? 'Não foi possível confirmar o horário.' })
      setConfirmacao(r.data.agendamento)
    } catch {
      setMensagem({ ok: false, texto: 'Falha de conexão. Verifique sua internet e tente novamente.' })
    } finally {
      setEnviando(false)
    }
  }

  function novoAgendamento() {
    setConfirmacao(null)
    setPasso(1)
    setServicoId('')
    setBarberId('')
    setHora('')
    setNome('')
    setTelefone('')
    setAceitoTermos(false)
    setMensagem(null)
  }

  const servico = catalogo?.servicos.find((s) => String(s.id) === servicoId)
  const barbeiro = catalogo?.barbeiros.find((b) => String(b.id) === barberId)
  const corPrimaria = corSegura(catalogo?.barbearia.corPrimaria, '#D4AF37')
  const corFundo = corSegura(catalogo?.barbearia.corFundo, '#0A0A0A')
  const estilo = { '--accent': corPrimaria, '--accent-contrast': corDeContraste(corPrimaria), '--shop-bg': corFundo } as CSSProperties

  if (erroCarregar) return <main className="public-booking-page" style={estilo}><section className="public-booking-empty"><Link className="public-back" href="/">Voltar ao início</Link><h1>{erroCarregar === 'nao-encontrada' ? 'Barbearia não encontrada' : 'Não foi possível carregar esta página'}</h1><p>{erroCarregar === 'nao-encontrada' ? 'Confira se o link está correto.' : 'O serviço está temporariamente indisponível. Tente novamente em instantes.'}</p>{erroCarregar === 'indisponivel' && <button type="button" className={botao} onClick={() => { setCatalogo(null); setErroCarregar(''); setTentativa((n) => n + 1) }}>Tentar novamente</button>}</section></main>
  if (!catalogo) return <main className="public-booking-page" style={estilo}><p className="public-loading">Carregando barbearia...</p></main>

  const b = catalogo.barbearia
  return (
    <main className="public-booking-page" style={estilo}>
      <header className="public-booking-nav">
        <Link className="public-booking-brand" href={`/agendar/${encodeURIComponent(b.slug)}`}>
          <span className="public-booking-mark" aria-hidden="true" />
          <span>{b.nome}</span>
        </Link>
        <Link className="public-back" href="/">Página inicial</Link>
      </header>

      <section className="public-booking-content">
        <div className="public-booking-intro">
          <p className="eyebrow">AGENDAMENTO ONLINE</p>
          <h1>{confirmacao ? 'Horário confirmado' : `Agende na ${b.nome}`}</h1>
          <p>{confirmacao ? 'Sua reserva foi registrada com sucesso.' : b.slogan || 'Escolha seu serviço, profissional e horário.'}</p>
        </div>

        {confirmacao ? (
          <section className="public-confirmation" aria-live="polite">
            <span className="public-confirmation-mark" aria-hidden="true">✓</span>
            <p className="eyebrow">RESERVA #{confirmacao.id}</p>
            <h2>{dataBR(confirmacao.data)} às {confirmacao.hora}</h2>
            <p>{servico?.nome} com {barbeiro?.nome}</p>
            <strong>{brl(confirmacao.preco)}</strong>
            <p className="muted">Guarde os dados do horário. Para alterar ou cancelar, entre em contato diretamente com a barbearia.</p>
            <button type="button" className={botao} onClick={novoAgendamento}>Fazer outro agendamento</button>
          </section>
        ) : (
          <section className="public-booking-panel">
            <div className="stepper" aria-label={`Etapa ${passo} de 4`}>
              {PASSOS.map((label, i) => <div key={label} className={`step${i + 1 === passo ? ' is-current' : ''}${i + 1 < passo ? ' is-done' : ''}`}><span className="step-index">{i + 1 < passo ? '✓' : i + 1}</span><span>{label}</span></div>)}
            </div>

            {passo === 1 && <div className="choice-grid">
              {catalogo.servicos.map((s) => <button key={s.id} type="button" className="choice-card" aria-pressed={servicoId === String(s.id)} onClick={() => { setServicoId(String(s.id)); setPasso(2) }}>
                <span className="choice-title">{s.nome}</span><span className="choice-detail">{s.dur} minutos</span><span className="choice-price">{brl(s.preco)}</span>
              </button>)}
              {!catalogo.servicos.length && <p className="empty-state">Esta barbearia ainda não tem serviços disponíveis.</p>}
            </div>}

            {passo === 2 && <div className="choice-grid">
              {catalogo.barbeiros.map((item) => <button key={item.id} type="button" className="choice-card" aria-pressed={barberId === String(item.id)} onClick={() => { setBarberId(String(item.id)); setPasso(3) }}>
                <span className="barber-choice">{item.foto ? <Image className="barber-choice-photo" src={item.foto} alt={`Foto de ${item.nome}`} width={48} height={48} unoptimized={!item.foto.startsWith('/')} /> : <span className="barber-photo-fallback" aria-hidden="true">{item.nome.slice(0, 1)}</span>}<span className="barber-choice-copy"><span className="choice-title">{item.nome}</span><span className="choice-detail">Profissional da equipe</span></span></span>
              </button>)}
              {!catalogo.barbeiros.length && <p className="empty-state">Esta barbearia ainda não tem profissionais disponíveis.</p>}
            </div>}

            {passo === 3 && <div className="public-date-time">
              <div><h2>Escolha o dia</h2><div className="date-strip" aria-label="Datas disponíveis">
                {datas.map((d) => <button key={d.valor} className="date-choice" type="button" aria-pressed={data === d.valor} onClick={() => setData(d.valor)}><small>{d.dia}</small><strong>{d.numero}</strong><small>{d.mes}</small></button>)}
              </div></div>
              <div><h2>Horários livres</h2>
                {carregandoHorarios ? <p className="muted">Buscando horários...</p> : erroHorarios ? <div><p className="error" role="status">Não foi possível consultar os horários. Tente novamente.</p><button type="button" className={botaoSec} onClick={() => void buscarHorarios()}>Tentar novamente</button></div> : horarios.length ? <div className="time-grid" aria-label="Horários disponíveis">{horarios.map((h) => <button key={h} type="button" className="time-choice" aria-pressed={hora === h} onClick={() => setHora(h)}>{h}</button>)}</div> : <p className="empty-state">{diaFechado ? 'A barbearia não abre neste dia. Escolha outra data.' : 'Sem horários livres nesta data. Escolha outro dia.'}</p>}
              </div>
            </div>}

            {passo === 4 && <form className="public-booking-form" onSubmit={confirmar}>
              <div className="booking-summary">
                <div><span className="muted">Serviço</span><strong>{servico?.nome}</strong></div>
                <div><span className="muted">Profissional</span><strong>{barbeiro?.nome}</strong></div>
                <div><span className="muted">Data e horário</span><strong>{dataBR(data)} às {hora}</strong></div>
                <div><span className="muted">Valor</span><strong>{servico ? brl(servico.preco) : ''}</strong></div>
              </div>
              <label>Seu nome completo<input className="field" autoComplete="name" maxLength={200} required value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome e sobrenome" /></label>
              <label>Telefone<input className="field" autoComplete="tel" inputMode="tel" maxLength={30} required value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(62) 99999-9999" /></label>
              <label className="public-terms"><input type="checkbox" checked={aceitoTermos} onChange={(e) => setAceitoTermos(e.target.checked)} required /><span>Li e aceito os <Link href="/termos" target="_blank">termos de uso</Link> e a <Link href="/privacidade" target="_blank">política de privacidade</Link>.</span></label>
              {mensagem && <p className={mensagem.ok ? 'success' : 'error'} role="status">{mensagem.texto}</p>}
              <button type="button" className={botaoSec} onClick={() => { setMensagem(null); setPasso(3) }}>Voltar para escolher horário</button>
              <button type="submit" className={botao} disabled={enviando || !aceitoTermos}>{enviando ? 'Confirmando...' : 'Confirmar agendamento'}</button>
            </form>}

            {passo < 4 && <div className="inline-row booking-actions">
              {passo > 1 && <button type="button" className={botaoSec} onClick={() => setPasso((n) => n - 1)}>Voltar</button>}
              {passo === 3 && <button type="button" className={botao} disabled={!hora || carregandoHorarios} onClick={() => { setMensagem(null); setPasso(4) }}>Continuar</button>}
            </div>}
            <div className="public-booking-footer"><Link href="/termos">Termos</Link><Link href="/privacidade">Privacidade</Link></div>
          </section>
        )}
      </section>
    </main>
  )
}
