'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api-client'
import Shell, { Cartao, Kpi, botao, botaoSec, brl, campo, dataBR, hojeBR } from '@/components/Shell'
import { AdminAgenda, AdminAgendamentos, AdminBarbeiros, AdminClientes, AdminConfiguracoes, AdminServicos } from '@/components/AdminAreas'

type Resumo = {
  atendimentos: number; bruto: number; comissoes: number; liquido: number; ticketMedio: number; previsto: number
  faltas: number; taxaFalta: number; porForma: Record<string, number>
  porBarbeiro: { barberId: number; nome: string; atendimentos: number; bruto: number; comissao: number }[]
}
type Evento = { ts: string; acao: string; resultado: string; userId: number | null; ip: string | null }
type Ag = { id: number; data: string; hora: string; servicoId: number; barberId: number; preco: number; status: string; clienteNome?: string }
type Catalogo = { barbeiros: { id: number; nome: string }[]; servicos: { id: number; nome: string }[] }
type Visao = 'resumo' | 'financeiro' | 'clientes' | 'agenda' | 'barbeiros' | 'servicos' | 'agendamentos' | 'configuracoes' | 'equipe'

function ResumoFinanceiro({ r }: { r: Resumo }) {
  return (
    <>
      <div className="grid-cards">
        <Kpi titulo="Atendimentos" valor={String(r.atendimentos)} />
        <Kpi titulo="Faturamento bruto" valor={brl(r.bruto)} />
        <Kpi titulo="Comissões" valor={brl(r.comissoes)} />
        <Kpi titulo="Líquido da barbearia" valor={brl(r.liquido)} />
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
  const [convite, setConvite] = useState<{ codigo: string; expira: string } | null>(null)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    const sincronizarVisao = () => {
      const view = window.location.hash.slice(1) as Visao
      setVisao(['financeiro', 'clientes', 'agenda', 'barbeiros', 'servicos', 'agendamentos', 'configuracoes', 'equipe'].includes(view) ? view : 'resumo')
    }
    sincronizarVisao()
    window.addEventListener('hashchange', sincronizarVisao)
    return () => window.removeEventListener('hashchange', sincronizarVisao)
  }, [])

  const carregar = useCallback(async () => {
    setCarregando(true)
    const [c, r, a, cat] = await Promise.all([
      api<Resumo>(`/api/admin/financeiro/caixa?data=${dia}`),
      api<Resumo>(`/api/admin/financeiro/relatorio?mes=${mes}`),
      api<{ agendamentos: Ag[] }>('/api/agendamentos'),
      api<Catalogo>('/api/catalogo'),
    ])
    setCaixa(c.ok ? c.data : null)
    setRel(r.ok ? r.data : null)
    if (a.ok && a.data) setAgendamentos(a.data.agendamentos)
    if (cat.ok && cat.data) setCatalogo(cat.data)
    setCarregando(false)
  }, [dia, mes])

  useEffect(() => { carregar() }, [carregar])

  const hoje = useMemo(() => {
    const itens = agendamentos.filter((a) => a.data === hojeBR())
    const pendentes = itens.filter((a) => a.status === 'agendado')
    const realizados = agendamentos.filter((a) => a.status === 'concluido')
    return { itens, pendentes, realizados }
  }, [agendamentos])

  async function gerarConvite() {
    setErro('')
    const r = await api<{ codigo: string; expira: string; erro?: string }>('/api/admin/convites', { method: 'POST' })
    if (r.ok && r.data) setConvite(r.data)
    else setErro(r.data?.erro ?? 'Não foi possível gerar o convite.')
  }
  async function verEventos() {
    const r = await api<{ eventos: Evento[] }>('/api/admin/auditoria')
    if (r.ok && r.data) setEventos(r.data.eventos.slice(0, 30))
    else setErro('Não foi possível carregar os eventos.')
  }

  const nomeServico = (id: number) => catalogo?.servicos.find((s) => s.id === id)?.nome ?? 'Serviço'
  const nomeBarbeiro = (id: number) => catalogo?.barbeiros.find((b) => b.id === id)?.nome ?? 'Equipe'
  const proximos = [...hoje.pendentes].sort((a, b) => a.hora.localeCompare(b.hora)).slice(0, 5)

  return (
    <Shell titulo="Painel do dono">
      {erro && <p className="error" role="alert">{erro}</p>}
      {catalogo && (!catalogo.barbeiros.length || !catalogo.servicos.length) && (
        <Cartao titulo="Finalize a configuração da sua agenda">
          <p className="muted">Cadastre pelo menos um profissional e um serviço para os clientes conseguirem reservar pelo link público.</p>
          <div className="inline-row">
            {!catalogo.barbeiros.length && <a className={botao} href="#barbeiros">Cadastrar profissional</a>}
            {!catalogo.servicos.length && <a className={botao} href="#servicos">Cadastrar serviço</a>}
          </div>
        </Cartao>
      )}

      {visao === 'resumo' && <>
        <div className="grid-cards">
          <Kpi titulo="Agendamentos hoje" valor={String(hoje.pendentes.length)} detalhe={`${hoje.itens.length} no total`} />
          <Kpi titulo="Faturamento hoje" valor={brl(caixa?.bruto ?? 0)} detalhe={`Previsto ${brl(caixa?.previsto ?? 0)}`} />
          <Kpi titulo="Aguardando baixa" valor={String(hoje.pendentes.length)} />
          <Kpi titulo="Faltas no mês" valor={String(rel?.faltas ?? 0)} detalhe={`${rel?.taxaFalta ?? 0}% do movimento`} />
          <Kpi titulo="Atendimentos realizados" valor={String(hoje.realizados.length)} detalhe="Histórico total disponível" />
          <Kpi titulo="Barbeiros ativos" valor={String(catalogo?.barbeiros.length ?? 0)} />
        </div>
        <Cartao titulo="Próximos atendimentos">
          {carregando ? <p className="muted">Carregando agenda...</p> : proximos.length === 0 ? <p className="empty-state">Nenhum atendimento marcado para hoje.</p> : proximos.map((a) => (
            <div className="list-row" key={a.id}>
              <div className="list-main"><p className="list-title">{a.hora} · {a.clienteNome ?? 'Cliente'}</p><p className="list-meta">{nomeServico(a.servicoId)} · {nomeBarbeiro(a.barberId)}</p></div>
              <span className="status-tag" data-status={a.status}>{brl(a.preco)}</span>
            </div>
          ))}
        </Cartao>
        <div className="inline-row"><a className={botaoSec} href="#financeiro">Ver caixa e relatório</a><a className={botaoSec} href="#equipe">Convidar profissional</a></div>
      </>}

      {visao === 'financeiro' && <div id="financeiro" className="page-section-stack">
        <Cartao titulo="Caixa do dia">
          <label className="inline-row muted">Data<input className={campo} type="date" value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} /></label>
          {caixa ? <ResumoFinanceiro r={caixa} /> : <p className="muted">Carregando caixa...</p>}
        </Cartao>
        <Cartao titulo="Relatório mensal">
          <div className="inline-row"><label className="inline-row muted">Mês<input className={campo} type="month" value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} /></label><a className={`${botaoSec} whitespace-nowrap`} href={`/api/admin/financeiro/relatorio?mes=${mes}&formato=csv`}>Baixar CSV</a></div>
          {rel ? <ResumoFinanceiro r={rel} /> : <p className="muted">Carregando relatório...</p>}
        </Cartao>
      </div>}

      {visao === 'equipe' && <div id="equipe" className="page-section-stack">
        <Cartao titulo="Convite para novo barbeiro">
          <p className="muted">Crie um código individual para cadastro de um novo profissional.</p>
          <button className={botao} onClick={gerarConvite}>Gerar código de convite</button>
          {convite && <div className="invite-result"><code>{convite.codigo}</code><span>Uso único · expira em {dataBR(convite.expira.slice(0, 10))} às {convite.expira.slice(11, 16)} UTC</span></div>}
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
      {visao === 'agendamentos' && <div id="agendamentos"><AdminAgendamentos /></div>}
      {visao === 'configuracoes' && <div id="configuracoes"><AdminConfiguracoes /></div>}
    </Shell>
  )
}
