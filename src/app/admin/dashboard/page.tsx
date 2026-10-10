'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api-client'
import Shell, { Cartao, Kpi, botao, botaoSec, brl, campo, dataBR, hojeBR } from '@/components/Shell'
import { AdminAgenda, AdminAgendamentos, AdminBarbeiros, AdminClientes, AdminConfiguracoes, AdminServicos } from '@/components/AdminAreas'
import AdminDespesas from '@/components/AdminDespesas'
import AdminFechamentoCaixa from '@/components/AdminFechamentoCaixa'
import AdminEstoque from '@/components/AdminEstoque'
import AdminRelatorios from '@/components/AdminRelatorios'

type Resumo = {
  atendimentos: number; bruto: number; comissoes: number; liquido: number; ticketMedio: number; previsto: number
  faltas: number; taxaFalta: number; porForma: Record<string, number>; despesas: number; saldoOperacional: number
  porBarbeiro: { barberId: number; nome: string; atendimentos: number; bruto: number; comissao: number }[]
}
type Evento = { ts: string; acao: string; resultado: string; userId: number | null; ip: string | null }
type Ag = { id: number; data: string; hora: string; servicoId: number; barberId: number; preco: number; status: string; clienteNome?: string }
type Catalogo = { barbeiros: { id: number; nome: string }[]; servicos: { id: number; nome: string }[] }
type Visao = 'resumo' | 'financeiro' | 'relatorios' | 'clientes' | 'agenda' | 'barbeiros' | 'servicos' | 'estoque' | 'agendamentos' | 'configuracoes' | 'equipe'

function ResumoFinanceiro({ r }: { r: Resumo }) {
  return (
    <>
      <div className="grid-cards">
        <Kpi titulo="Atendimentos" valor={String(r.atendimentos)} />
        <Kpi titulo="Faturamento bruto" valor={brl(r.bruto)} />
        <Kpi titulo="Comissões" valor={brl(r.comissoes)} />
        <Kpi titulo="Após comissões" valor={brl(r.liquido)} />
        <Kpi titulo="Despesas operacionais" valor={brl(r.despesas ?? 0)} />
        <Kpi titulo="Saldo real do caixa" valor={brl(r.saldoOperacional ?? r.liquido)} />
        <Kpi titulo="Ticket médio" valor={brl(r.ticketMedio)} />
        <Kpi titulo="A receber" valor={brl(r.previsto)} />
        <Kpi titulo="Faltas" valor={`${r.faltas} · ${r.taxaFalta}%`} />
      </div>
      {Object.keys(r.porForma).length > 0 && (
        <div className="inline-row muted" aria-label="Totais por forma de pagamento">
          {Object.entries(r.porForma).map(([f, v]) => <span key={f}>{f}: {brl(v)}</span>)}
        </div>
      )}
      {r.porBarbeiro.length > 0 && (
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Barbeiro</th><th>Atendimentos</th><th>Bruto</th><th>Comissão</th></tr></thead>
          <tbody>{r.porBarbeiro.map((b) => <tr key={b.barberId}><td>{b.nome}</td><td>{b.atendimentos}</td><td>{brl(b.bruto)}</td><td>{brl(b.comissao)}</td></tr>)}</tbody>
        </table></div>
      )}
    </>
  )
}

export default function Dashboard() {
  const [visao, setVisao] = useState<Visao>('resumo')
  const [dia, setDia] = useState(hojeBR())
  const [mes, setMes] = useState(hojeBR().slice(0, 7))
  const [caixa, setCaixa] = useState<Resumo | null>(null)
  const [rel, setRel] = useState<Resumo | null>(null)
  const [agendamentos, setAgendamentos] = useState<Ag[]>([])
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
  const [convite, setConvite] = useState<{ codigo: string; expira: string; role: 'barbeiro' | 'recepcionista' } | null>(null)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [erro, setErro] = useState('')
  const [erroCaixa, setErroCaixa] = useState('')
  const [erroAgenda, setErroAgenda] = useState('')
  const [erroRelatorio, setErroRelatorio] = useState('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const sincronizarVisao = () => {
      const view = window.location.hash.slice(1) as Visao
      setVisao(['financeiro', 'relatorios', 'clientes', 'agenda', 'barbeiros', 'servicos', 'estoque', 'agendamentos', 'configuracoes', 'equipe'].includes(view) ? view : 'resumo')
    }
    sincronizarVisao()
    window.addEventListener('hashchange', sincronizarVisao)
    return () => window.removeEventListener('hashchange', sincronizarVisao)
  }, [])

  const carregar = useCallback(async () => {
    setCarregando(true)
    setCaixa(null)
    setRel(null)
    setAgendamentos([])
    setErroCaixa('')
    setErroAgenda('')
    setErroRelatorio('')
    try {
      const [c, a, cat, r] = await Promise.all([
        api<Resumo>(`/api/admin/financeiro/caixa?data=${dia}`),
        api<{ agendamentos: Ag[] }>('/api/agendamentos'),
        api<Catalogo>('/api/catalogo'),
        visao === 'financeiro' ? api<Resumo>(`/api/admin/financeiro/relatorio?mes=${mes}`) : Promise.resolve(null),
      ])
      setCaixa(c.ok ? c.data : null)
      if (!c.ok) setErroCaixa('Não foi possível consultar o caixa. Tente atualizar.')
      if (a.ok && a.data) setAgendamentos(a.data.agendamentos)
      else setErroAgenda('Não foi possível carregar os agendamentos. Tente atualizar.')
      if (cat.ok && cat.data) setCatalogo(cat.data)
      if (visao === 'financeiro') {
        setRel(r?.ok ? r.data : null)
        if (!r?.ok) setErroRelatorio('Não foi possível carregar o relatório mensal. Tente atualizar.')
      }
    } catch {
      setErroCaixa('Falha de conexão ao carregar o painel. Tente novamente.')
      setErroAgenda('Falha de conexão ao carregar os agendamentos. Tente novamente.')
      if (visao === 'financeiro') setErroRelatorio('Falha de conexão ao carregar o relatório. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }, [dia, mes, visao])

  useEffect(() => { carregar() }, [carregar])

  const hoje = useMemo(() => {
    const itens = agendamentos.filter((a) => a.data === hojeBR())
    const pendentes = itens.filter((a) => a.status === 'agendado')
    return { itens, pendentes }
  }, [agendamentos])

  async function gerarConvite(role: 'barbeiro' | 'recepcionista') {
    setErro('')
    const r = await api<{ codigo: string; expira: string; erro?: string }>('/api/admin/convites', { method: 'POST', body: JSON.stringify({ role }) })
    if (r.ok && r.data) setConvite({ ...r.data, role })
    else setErro(r.data?.erro ?? 'Não foi possível gerar o convite.')
  }
  async function verEventos() {
    const r = await api<{ eventos: Evento[] }>('/api/admin/auditoria')
    if (r.ok && r.data) setEventos(r.data.eventos.slice(0, 30))
    else setErro('Não foi possível carregar os eventos.')
  }

  const nomeServico = (id: number) => catalogo?.servicos.find((s) => s.id === id)?.nome ?? 'Serviço'
  const nomeBarbeiro = (id: number) => catalogo?.barbeiros.find((b) => b.id === id)?.nome ?? 'Equipe'
  const agora = new Date().toLocaleTimeString('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false })
  const pendencias = agendamentos.filter((a) => a.status === 'agendado' && (a.data < hojeBR() || (a.data === hojeBR() && a.hora < agora))).sort((a, b) => `${a.data}${a.hora}`.localeCompare(`${b.data}${b.hora}`))
  const dashboardCardClass = 'bg-barber-card border border-barber-border rounded-xl p-6 shadow-sm !bg-barber-card !border-barber-border !rounded-xl !shadow-sm'
  const dashboardHeadingClass = '!min-h-0 !p-0 !pb-4'
  const dashboardBodyClass = '!p-0'
  const dashboardTitleClass = 'text-lg font-medium text-gray-200 mb-4'

  return (
    <Shell titulo="Operação de hoje" mainClassName="p-8 !p-8" titleClassName="text-3xl font-serif text-white mb-8 !text-3xl !text-white">
      {erro && <p className="error" role="alert">{erro}</p>}
      {visao !== 'resumo' && catalogo && (!catalogo.barbeiros.length || !catalogo.servicos.length) && (
        <Cartao titulo="Finalize a configuração da sua agenda">
          <p className="muted">Cadastre pelo menos um profissional e um serviço para os clientes conseguirem reservar pelo link público.</p>
          <div className="inline-row">
            {!catalogo.barbeiros.length && <a className={botao} href="#barbeiros">Cadastrar profissional</a>}
            {!catalogo.servicos.length && <a className={botao} href="#servicos">Cadastrar serviço</a>}
          </div>
        </Cartao>
      )}

      {visao === 'resumo' && <>
        <div className="today-dashboard">
          <Cartao titulo="Faturamento de hoje" className={`today-money ${dashboardCardClass}`} headingClassName={dashboardHeadingClass} bodyClassName={dashboardBodyClass} titleClassName={dashboardTitleClass}>
            {erroCaixa ? <><p className="error" role="alert">{erroCaixa}</p><button type="button" className={botaoSec} onClick={carregar}>Tentar novamente</button></> : carregando && !caixa ? <p className="muted">Consultando o caixa...</p> : <>
            <strong className="today-money-value text-barber-gold font-bold !text-barber-gold">{brl(caixa?.bruto ?? 0)}</strong>
            <p className="muted">{caixa?.atendimentos ?? 0} atendimento(s) com pagamento confirmado.</p>
            <div className="today-money-detail"><span>Em aberto hoje</span><strong className="text-barber-gold font-bold !text-barber-gold">{brl(caixa?.previsto ?? 0)}</strong></div>
            <a className="block w-full mt-4 border border-white/10 bg-white/5 py-2 text-center text-white transition hover:bg-white/10 rounded-lg" href="#financeiro">Ver caixa completo</a>
            </>}
          </Cartao>
          <Cartao titulo={`Próximos atendimentos (${hoje.pendentes.length})`} className={`today-list-panel ${dashboardCardClass}`} headingClassName={dashboardHeadingClass} bodyClassName={dashboardBodyClass} titleClassName={dashboardTitleClass}>
            {erroAgenda ? <><p className="error" role="alert">{erroAgenda}</p><button type="button" className={botaoSec} onClick={carregar}>Tentar novamente</button></> : carregando ? <p className="muted">Carregando agenda...</p> : hoje.pendentes.length === 0 ? <p className="empty-state">Nenhum agendamento pendente para hoje.</p> : <div className="today-list">{[...hoje.pendentes].sort((a, b) => a.hora.localeCompare(b.hora)).map((a) => (
              <div className="list-row" key={a.id}>
                <div className="list-main"><p className="list-title">{a.hora} · {a.clienteNome ?? 'Cliente'}</p><p className="list-meta">{nomeServico(a.servicoId)} · {nomeBarbeiro(a.barberId)}</p></div>
                <span className="status-tag text-barber-gold font-bold !text-barber-gold" data-status={a.status}>{brl(a.preco)}</span>
              </div>
            ))}</div>}
          </Cartao>
          <Cartao titulo={`Pendências de pagamento${erroAgenda ? '' : ` (${pendencias.length})`}`} className={`today-list-panel ${dashboardCardClass}`} headingClassName={dashboardHeadingClass} bodyClassName={dashboardBodyClass} titleClassName={dashboardTitleClass}>
            {erroAgenda ? <><p className="error" role="alert">{erroAgenda}</p><button type="button" className={botaoSec} onClick={carregar}>Tentar novamente</button></> : carregando ? <p className="muted">Conferindo pendências...</p> : pendencias.length === 0 ? <p className="empty-state">Nenhum atendimento sem baixa até agora.</p> : <div className="today-list">{pendencias.map((a) => (
              <div className="list-row" key={a.id}>
                <div className="list-main"><p className="list-title">{a.clienteNome ?? 'Cliente'} · <span className="text-barber-gold font-bold !text-barber-gold">{brl(a.preco)}</span></p><p className="list-meta">{dataBR(a.data)} às {a.hora} · {nomeServico(a.servicoId)}</p></div>
                <a className="inline-flex items-center justify-center bg-transparent border border-barber-gold text-barber-gold hover:bg-barber-gold hover:text-black px-4 py-2 rounded-lg text-sm transition-all" href="#agendamentos">Dar baixa</a>
              </div>
            ))}</div>}
          </Cartao>
        </div>
      </>}

      {visao === 'financeiro' && <div id="financeiro" className="page-section-stack">
        <Cartao titulo="Caixa do dia">
          <label className="inline-row muted">Data<input className={campo} type="date" value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} /></label>
          {caixa ? <ResumoFinanceiro r={caixa} /> : erroCaixa ? <div><p className="error" role="alert">{erroCaixa}</p><button type="button" className={botaoSec} onClick={carregar}>Tentar novamente</button></div> : <p className="muted">Carregando caixa...</p>}
        </Cartao>
        <Cartao titulo="Despesas do dia">
          <AdminDespesas data={dia} aoAlterar={carregar} />
        </Cartao>
        <Cartao titulo="Fechamento de caixa">
          <AdminFechamentoCaixa data={dia} atualizacao={caixa?.despesas ?? 0} aoAlterar={carregar} />
        </Cartao>
        <Cartao titulo="Relatório mensal">
          <div className="inline-row"><label className="inline-row muted">Mês<input className={campo} type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} /></label><a className={`${botaoSec} whitespace-nowrap`} href={`/api/admin/financeiro/relatorio?mes=${mes}&formato=csv`}>Baixar CSV</a></div>
          {rel ? <ResumoFinanceiro r={rel} /> : erroRelatorio ? <div><p className="error" role="alert">{erroRelatorio}</p><button type="button" className={botaoSec} onClick={carregar}>Tentar novamente</button></div> : <p className="muted">Carregando relatório...</p>}
        </Cartao>
      </div>}

      {visao === 'relatorios' && <div id="relatorios"><AdminRelatorios /></div>}

      {visao === 'equipe' && <div id="equipe" className="page-section-stack">
        <Cartao titulo="Convites para a equipe">
          <p className="muted">Cada código é individual, vale uma vez e expira conforme o prazo da barbearia.</p>
          <div className="inline-row"><button className={botao} onClick={() => gerarConvite('barbeiro')}>Convidar barbeiro</button><button className={botaoSec} onClick={() => gerarConvite('recepcionista')}>Convidar atendente</button></div>
          {convite && <div className="invite-result"><code>{convite.codigo}</code><span>Cadastro de {convite.role === 'recepcionista' ? 'atendente' : 'barbeiro'} · uso único · expira em {dataBR(convite.expira.slice(0, 10))} às {convite.expira.slice(11, 16)} UTC</span></div>}
        </Cartao>
        <Cartao titulo="Eventos de segurança">
          <div className="inline-row"><button className={botaoSec} onClick={verEventos}>Atualizar eventos</button><span className="muted">Acessos, tentativas negadas e alterações recentes.</span></div>
          {eventos.length === 0 ? <p className="empty-state">Nenhum evento carregado.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Horário</th><th>Ação</th><th>Resultado</th><th>Usuário</th><th>IP</th></tr></thead><tbody>{eventos.map((e, i) => <tr key={`${e.ts}-${i}`}><td>{e.ts.slice(0, 19).replace('T', ' ')}</td><td>{e.acao}</td><td>{e.resultado}</td><td>{e.userId ?? '—'}</td><td>{e.ip ?? '—'}</td></tr>)}</tbody></table></div>}
        </Cartao>
      </div>}

      {visao === 'clientes' && <div id="clientes"><AdminClientes /></div>}
      {visao === 'agenda' && <div id="agenda"><AdminAgenda /></div>}
      {visao === 'barbeiros' && <div id="barbeiros"><AdminBarbeiros /></div>}
      {visao === 'servicos' && <div id="servicos"><AdminServicos /></div>}
      {visao === 'estoque' && <div id="estoque"><AdminEstoque /></div>}
      {visao === 'agendamentos' && <div id="agendamentos"><AdminAgendamentos /></div>}
      {visao === 'configuracoes' && <div id="configuracoes"><AdminConfiguracoes /></div>}
    </Shell>
  )
}
