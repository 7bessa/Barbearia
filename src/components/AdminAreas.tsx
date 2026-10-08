'use client'
import { FormEvent, useCallback, useEffect, useState, type CSSProperties } from 'react'
import { api } from '@/lib/api-client'
import { Cartao, botao, botaoSec, brl, campo, dataBR, hojeBR, somaDias } from '@/components/Shell'
import { useAuth } from '@/store/auth'
import { normalizarSlug } from '@/lib/slug-barbearia'

type Barbeiro = { id: number; nome: string; comissao: number; ativo: boolean; temLogin?: boolean }
type Servico = { id: number; nome: string; preco: number; dur: number; ativo: boolean }
type Cliente = { id: number; nome: string; telefone: string; email?: string; semConta?: boolean; visitas: number; faltas: number; ultimoAtendimento: string | null; totalGasto?: number }
type DetalheCliente = {
  cliente: { id: number; nome: string; telefone: string; email?: string; semConta: boolean }
  resumo: { visitas: number; faltas: number; cancelados: number; ultimoAtendimento: string | null; totalGasto?: number }
  historico: { id: number; data: string; hora: string; status: string; valor: number; forma: string | null; servico: string; barbeiro: string }[]
  notas: { id: number; autorId: number; autorNome: string; texto: string; criadaEm: string }[]
}
type Ag = { id: number; data: string; hora: string; servicoId: number; barberId: number; dur: number; preco: number; status: string; clienteId?: number; clienteNome?: string; clienteTel?: string; forma?: string | null }
type Catalogo = { barbeiros: { id: number; nome: string }[]; servicos: { id: number; nome: string; preco: number; dur: number }[]; horario: Horario }
type Horario = { abre: string; fecha: string; almocoIni: string | null; almocoFim: string | null; dias: number[] }
type Bloqueio = { id: number; barberId: number; data: string; ini: string; fim: string; motivo: string }

const erroApi = (data: unknown, fallback: string) => {
  if (data && typeof data === 'object' && 'erro' in data && typeof data.erro === 'string') return data.erro
  return fallback
}
const minutos = (hora: string) => { const [h, m] = hora.split(':').map(Number); return h * 60 + m }
const horaTxt = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

export function AdminBarbeiros() {
  const [itens, setItens] = useState<Barbeiro[]>([])
  const [editando, setEditando] = useState<number | null>(null)
  const [nome, setNome] = useState('')
  const [comissao, setComissao] = useState('40')
  const [ativo, setAtivo] = useState(true)
  const [msg, setMsg] = useState('')
  const carregar = useCallback(async () => { const r = await api<{ barbeiros: Barbeiro[] }>('/api/admin/barbeiros'); if (r.ok && r.data) setItens(r.data.barbeiros) }, [])
  useEffect(() => { carregar() }, [carregar])
  const limpar = () => { setEditando(null); setNome(''); setComissao('40'); setAtivo(true) }
  const editar = (b: Barbeiro) => { setEditando(b.id); setNome(b.nome); setComissao(String(b.comissao)); setAtivo(b.ativo) }
  async function salvar(e: FormEvent) {
    e.preventDefault(); setMsg('')
    const body = JSON.stringify({ nome: nome.trim(), comissao: Number(comissao), ativo })
    const r = await api<{ erro?: string }>(editando ? `/api/admin/barbeiros/${editando}` : '/api/admin/barbeiros', { method: editando ? 'PATCH' : 'POST', body })
    if (!r.ok) return setMsg(erroApi(r.data, 'Não foi possível salvar o barbeiro.'))
    limpar(); setMsg('Barbeiro salvo.'); carregar()
  }
  async function remover(b: Barbeiro) {
    if (!confirm(`Remover ${b.nome}? Se houver histórico ou login, o profissional será desativado.`)) return
    const r = await api<{ erro?: string }>(`/api/admin/barbeiros/${b.id}`, { method: 'DELETE' })
    if (!r.ok) setMsg(erroApi(r.data, 'Não foi possível remover.')); else { setMsg('Barbeiro removido ou desativado.'); if (editando === b.id) limpar(); carregar() }
  }
  return <Cartao titulo="Barbeiros">
    <form className="module-form" onSubmit={salvar}>
      <label>Nome<input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} required /></label>
      <label>Comissão (%)<input className={campo} type="number" min="0" max="100" step="1" value={comissao} onChange={(e) => setComissao(e.target.value)} required /></label>
      {editando !== null && <label className="check-label"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Profissional ativo</label>}
      <div className="inline-row"><button className={botao}>{editando ? 'Salvar alterações' : 'Adicionar barbeiro'}</button>{editando !== null && <button type="button" className={botaoSec} onClick={limpar}>Cancelar edição</button>}</div>
    </form>
    {msg && <p className="muted" role="status">{msg}</p>}
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Nome</th><th>Comissão</th><th>Acesso</th><th>Status</th><th>Ações</th></tr></thead><tbody>
      {itens.map((b) => <tr key={b.id}><td>{b.nome}</td><td>{b.comissao}%</td><td>{b.temLogin ? 'Conta ativa' : 'Sem login'}</td><td><span className="status-tag" data-status={b.ativo ? 'concluido' : 'cancelado'}>{b.ativo ? 'Ativo' : 'Inativo'}</span></td><td><div className="inline-row"><button className={botaoSec} onClick={() => editar(b)}>Editar</button><button className="button button-danger" onClick={() => remover(b)}>Remover</button></div></td></tr>)}
      {itens.length === 0 && <tr><td colSpan={5} className="muted">Nenhum barbeiro cadastrado.</td></tr>}
    </tbody></table></div>
  </Cartao>
}

export function AdminServicos() {
  const [itens, setItens] = useState<Servico[]>([])
  const [editando, setEditando] = useState<number | null>(null)
  const [nome, setNome] = useState('')
  const [preco, setPreco] = useState('')
  const [dur, setDur] = useState('30')
  const [ativo, setAtivo] = useState(true)
  const [msg, setMsg] = useState('')
  const carregar = useCallback(async () => { const r = await api<{ servicos: Servico[] }>('/api/admin/servicos'); if (r.ok && r.data) setItens(r.data.servicos) }, [])
  useEffect(() => { carregar() }, [carregar])
  const limpar = () => { setEditando(null); setNome(''); setPreco(''); setDur('30'); setAtivo(true) }
  const editar = (s: Servico) => { setEditando(s.id); setNome(s.nome); setPreco(String(s.preco)); setDur(String(s.dur)); setAtivo(s.ativo) }
  async function salvar(e: FormEvent) {
    e.preventDefault(); setMsg('')
    const body = JSON.stringify({ nome: nome.trim(), preco: Number(preco), dur: Number(dur), ativo })
    const r = await api<{ erro?: string }>(editando ? `/api/admin/servicos/${editando}` : '/api/admin/servicos', { method: editando ? 'PATCH' : 'POST', body })
    if (!r.ok) return setMsg(erroApi(r.data, 'Não foi possível salvar o serviço.'))
    limpar(); setMsg('Serviço salvo.'); carregar()
  }
  async function remover(s: Servico) {
    if (!confirm(`Remover ${s.nome}? Serviços usados em atendimentos serão desativados.`)) return
    const r = await api<{ erro?: string }>(`/api/admin/servicos/${s.id}`, { method: 'DELETE' })
    if (!r.ok) setMsg(erroApi(r.data, 'Não foi possível remover.')); else { setMsg('Serviço removido ou desativado.'); if (editando === s.id) limpar(); carregar() }
  }
  return <Cartao titulo="Serviços">
    <form className="module-form" onSubmit={salvar}>
      <label>Nome<input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} maxLength={60} required /></label>
      <label>Preço (R$)<input className={campo} type="number" min="1" max="9999" step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} required /></label>
      <label>Duração (minutos)<input className={campo} type="number" min="5" max="480" step="5" value={dur} onChange={(e) => setDur(e.target.value)} required /></label>
      {editando !== null && <label className="check-label"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Serviço ativo</label>}
      <div className="inline-row"><button className={botao}>{editando ? 'Salvar alterações' : 'Adicionar serviço'}</button>{editando !== null && <button type="button" className={botaoSec} onClick={limpar}>Cancelar edição</button>}</div>
    </form>
    {msg && <p className="muted" role="status">{msg}</p>}
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Serviço</th><th>Preço</th><th>Duração</th><th>Status</th><th>Ações</th></tr></thead><tbody>
      {itens.map((s) => <tr key={s.id}><td>{s.nome}</td><td>{brl(s.preco)}</td><td>{s.dur} min</td><td><span className="status-tag" data-status={s.ativo ? 'concluido' : 'cancelado'}>{s.ativo ? 'Ativo' : 'Inativo'}</span></td><td><div className="inline-row"><button className={botaoSec} onClick={() => editar(s)}>Editar</button><button className="button button-danger" onClick={() => remover(s)}>Remover</button></div></td></tr>)}
      {itens.length === 0 && <tr><td colSpan={5} className="muted">Nenhum serviço cadastrado.</td></tr>}
    </tbody></table></div>
  </Cartao>
}

export function AdminConfiguracoes() {
  const [horario, setHorario] = useState<Horario | null>(null)
  const [msg, setMsg] = useState('')
  const [erroHorario, setErroHorario] = useState('')
  const carregar = useCallback(async () => {
    setErroHorario('')
    const r = await api<{ horario: Horario; erro?: string }>('/api/admin/horarios')
    if (r.ok && r.data) setHorario(r.data.horario)
    else setErroHorario(erroApi(r.data, 'Não foi possível carregar o horário de funcionamento.'))
  }, [])
  useEffect(() => { carregar() }, [carregar])
  function alterar(chave: keyof Horario, valor: string | number[] | null) { setHorario((h) => h ? { ...h, [chave]: valor } : h) }
  async function salvar(e: FormEvent) {
    e.preventDefault(); if (!horario) return
    setMsg('')
    const r = await api<{ horario?: Horario; erro?: string }>('/api/admin/horarios', { method: 'PUT', body: JSON.stringify(horario) })
    if (!r.ok) return setMsg(erroApi(r.data, 'Não foi possível salvar o horário.'))
    setHorario(r.data?.horario ?? horario); setMsg('Horário de funcionamento atualizado.')
  }
  if (!horario) return <><AdminMarca /><Cartao titulo="Horário de funcionamento">
    <p className={erroHorario ? 'error' : 'muted'} role={erroHorario ? 'alert' : undefined}>{erroHorario || 'Carregando horário...'}</p>
    {erroHorario && <button type="button" className={botaoSec} onClick={carregar}>Tentar novamente</button>}
  </Cartao></>
  const dias = [['Dom', 0], ['Seg', 1], ['Ter', 2], ['Qua', 3], ['Qui', 4], ['Sex', 5], ['Sáb', 6]] as const
  return <><AdminMarca /><Cartao titulo="Horário de funcionamento">
    <form className="settings-form" onSubmit={salvar}>
      <div className="module-form">
        <label>Abertura<input className={campo} type="time" value={horario.abre} onChange={(e) => alterar('abre', e.target.value)} required /></label>
        <label>Fechamento<input className={campo} type="time" value={horario.fecha} onChange={(e) => alterar('fecha', e.target.value)} required /></label>
        <label>Início do almoço<input className={campo} type="time" value={horario.almocoIni ?? ''} onChange={(e) => alterar('almocoIni', e.target.value || null)} /></label>
        <label>Fim do almoço<input className={campo} type="time" value={horario.almocoFim ?? ''} onChange={(e) => alterar('almocoFim', e.target.value || null)} /></label>
      </div>
      <fieldset className="days-fieldset"><legend>Dias de atendimento</legend><div className="inline-row">{dias.map(([label, valor]) => <label className="day-check" key={valor}><input type="checkbox" checked={horario.dias.includes(valor)} onChange={(e) => alterar('dias', e.target.checked ? [...horario.dias, valor].sort() : horario.dias.filter((d) => d !== valor))} />{label}</label>)}</div></fieldset>
      {msg && <p className={msg.startsWith('Não') ? 'error' : 'success'} role="status">{msg}</p>}
      <button className={botao}>Salvar horário</button>
    </form>
  </Cartao></>
}

type Marca = { id: number; nome: string; slogan: string; slug: string; corPrimaria: string; corFundo: string }
const corHex = (valor: string, padrao: string) => /^#[0-9a-fA-F]{6}$/.test(valor) ? valor : padrao

function AdminMarca() {
  const [marca, setMarca] = useState<Marca | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [copiado, setCopiado] = useState(false)
  const [msg, setMsg] = useState('')
  const [origem, setOrigem] = useState('')
  const carregar = useCallback(async () => {
    const r = await api<{ barbearia: Marca; erro?: string }>('/api/admin/barbearia')
    if (r.ok && r.data) {
      setMarca({ ...r.data.barbearia, corPrimaria: corHex(r.data.barbearia.corPrimaria, '#fbbf24'), corFundo: corHex(r.data.barbearia.corFundo, '#09090b') })
    } else setMsg(erroApi(r.data, 'Não foi possível carregar a identidade da barbearia.'))
    setCarregando(false)
  }, [])
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { setOrigem(window.location.origin) }, [])

  const link = marca ? `${origem}/agendar/${marca.slug}` : ''
  const estilo = marca ? { '--brand-preview-bg': marca.corFundo, '--brand-preview-accent': marca.corPrimaria } as CSSProperties : undefined
  function alterar(chave: keyof Marca, valor: string) { setMarca((atual) => atual ? { ...atual, [chave]: valor } : atual) }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!marca) return
    setMsg('')
    setSalvando(true)
    const r = await api<{ barbearia?: Marca; erro?: string }>('/api/admin/barbearia', {
      method: 'PUT',
      body: JSON.stringify({ nome: marca.nome, slogan: marca.slogan, slug: marca.slug, corPrimaria: marca.corPrimaria, corFundo: marca.corFundo }),
    })
    setSalvando(false)
    if (!r.ok || !r.data?.barbearia) return setMsg(erroApi(r.data, 'Não foi possível salvar a identidade.'))
    setMarca(r.data.barbearia)
    setMsg('Identidade e link público atualizados.')
  }

  async function copiarLink() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
      window.setTimeout(() => setCopiado(false), 1800)
    } catch {
      setMsg('Não foi possível copiar automaticamente. Selecione o endereço e copie-o.')
    }
  }

  if (!marca) return <Cartao titulo="Marca e link público">
    <p className={msg ? 'error' : 'muted'} role={msg ? 'alert' : undefined}>{carregando ? 'Carregando identidade...' : msg || 'Identidade indisponível.'}</p>
    {msg && <button type="button" className={botaoSec} onClick={() => { setCarregando(true); carregar() }}>Tentar novamente</button>}
  </Cartao>

  return <Cartao titulo="Marca e link público">
    <form className="settings-form" onSubmit={salvar}>
      <div className="module-form">
        <label>Nome da barbearia<input className={campo} value={marca.nome} maxLength={70} onChange={(e) => alterar('nome', e.target.value)} required /></label>
        <label>Frase curta<input className={campo} value={marca.slogan} maxLength={100} onChange={(e) => alterar('slogan', e.target.value)} /></label>
        <label>Endereço do link<input className={campo} value={marca.slug} maxLength={48} autoCapitalize="none" autoCorrect="off" onChange={(e) => alterar('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-'))} required /></label>
        <label className="brand-color-field">Cor principal<input type="color" value={marca.corPrimaria} onChange={(e) => alterar('corPrimaria', e.target.value)} /></label>
        <label className="brand-color-field">Cor de fundo<input type="color" value={marca.corFundo} onChange={(e) => alterar('corFundo', e.target.value)} /></label>
      </div>
      <button type="button" className={botaoSec} onClick={() => alterar('slug', normalizarSlug(marca.nome))}>Gerar endereço pelo nome</button>
      <div className="brand-preview" style={estilo}><span>AGENDAMENTO ONLINE</span><strong>{marca.nome || 'Sua barbearia'}</strong><small>{marca.slogan || 'Escolha seu serviço e horário.'}</small></div>
      <div className="public-link-row">
        <label>Link para compartilhar<input className={campo} value={link} readOnly onFocus={(e) => e.currentTarget.select()} /></label>
        <div className="inline-row"><button type="button" className={botaoSec} onClick={copiarLink}>{copiado ? 'Copiado' : 'Copiar link'}</button><a className="link-muted" href={link} target="_blank" rel="noreferrer">Abrir página pública</a></div>
      </div>
      {msg && <p className={msg.startsWith('Não') ? 'error' : 'success'} role="status">{msg}</p>}
      <button className={botao} disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar identidade'}</button>
    </form>
  </Cartao>
}

export function AdminClientes() {
  const [query, setQuery] = useState('')
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [total, setTotal] = useState(0)
  const [selecionado, setSelecionado] = useState<DetalheCliente | null>(null)
  const [nota, setNota] = useState('')
  const [msg, setMsg] = useState('')
  const carregar = useCallback(async () => {
    const params = new URLSearchParams({ q: busca, pagina: String(pagina) })
    const r = await api<{ clientes: Cliente[]; total: number }>(`/api/clientes?${params}`)
    if (r.ok && r.data) { setClientes(r.data.clientes); setTotal(r.data.total) }
  }, [busca, pagina])
  useEffect(() => { carregar() }, [carregar])
  async function abrir(id: number) {
    const r = await api<DetalheCliente>(`/api/clientes/${id}`)
    if (r.ok && r.data) { setSelecionado(r.data); setMsg('') }
    else setMsg(erroApi(r.data, 'Não foi possível abrir a ficha.'))
  }
  async function salvarNota(e: FormEvent) {
    e.preventDefault(); if (!selecionado || !nota.trim()) return
    const r = await api<{ erro?: string }>(`/api/clientes/${selecionado.cliente.id}/notas`, { method: 'POST', body: JSON.stringify({ texto: nota }) })
    if (!r.ok) return setMsg(erroApi(r.data, 'Não foi possível salvar a observação.'))
    setNota(''); abrir(selecionado.cliente.id)
  }
  async function removerNota(id: number) {
    if (!selecionado) return
    const r = await api<{ erro?: string }>(`/api/clientes/${selecionado.cliente.id}/notas?notaId=${id}`, { method: 'DELETE' })
    if (!r.ok) setMsg(erroApi(r.data, 'Não foi possível remover a observação.')); else abrir(selecionado.cliente.id)
  }
  return <>
    <Cartao titulo="Clientes">
      <form className="inline-row" onSubmit={(e) => { e.preventDefault(); setPagina(1); setBusca(query.trim()) }}>
        <input className={campo} aria-label="Buscar clientes" placeholder="Buscar por nome ou telefone" value={query} onChange={(e) => setQuery(e.target.value)} />
        <button className={botaoSec}>Buscar</button>
      </form>
      {msg && !selecionado && <p className="error" role="alert">{msg}</p>}
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Nome</th><th>Telefone</th><th>Visitas</th><th>Faltas</th><th>Última visita</th><th>Total gasto</th><th></th></tr></thead><tbody>
        {clientes.map((c) => <tr key={c.id}><td>{c.nome}</td><td>{c.telefone || '—'}</td><td>{c.visitas}</td><td>{c.faltas}</td><td>{c.ultimoAtendimento ? dataBR(c.ultimoAtendimento) : '—'}</td><td>{brl(c.totalGasto ?? 0)}</td><td><button className={botaoSec} onClick={() => abrir(c.id)}>Ver ficha</button></td></tr>)}
        {clientes.length === 0 && <tr><td colSpan={7} className="muted">Nenhum cliente encontrado.</td></tr>}
      </tbody></table></div>
      <div className="inline-row table-pagination"><span className="muted">{total} cliente(s)</span><button className={botaoSec} disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button><span className="muted">Página {pagina}</span><button className={botaoSec} disabled={clientes.length < 50 || pagina * 50 >= total} onClick={() => setPagina((p) => p + 1)}>Próxima</button></div>
    </Cartao>
    {selecionado && <Cartao titulo={`Ficha de ${selecionado.cliente.nome}`}>
      <div className="inline-row ficha-summary"><span>{selecionado.cliente.telefone}</span><span>{selecionado.resumo.visitas} visitas</span><span>{selecionado.resumo.faltas} faltas</span><span>{brl(selecionado.resumo.totalGasto ?? 0)} total</span><button className={botaoSec} onClick={() => setSelecionado(null)}>Fechar ficha</button></div>
      <h3>Observações internas</h3><p className="muted">Visíveis apenas para a equipe. Não registre dados sensíveis.</p>
      <form className="inline-row" onSubmit={salvarNota}><input className={campo} placeholder="Ex.: prefere degradê baixo" value={nota} maxLength={500} onChange={(e) => setNota(e.target.value)} /><button className={botao}>Adicionar observação</button></form>
      {msg && <p className="error" role="alert">{msg}</p>}
      {selecionado.notas.map((n) => <div className="list-row" key={n.id}><div className="list-main"><p className="list-title">{n.texto}</p><p className="list-meta">{n.autorNome} · {new Date(n.criadaEm).toLocaleDateString('pt-BR')}</p></div><button className="button button-danger" onClick={() => removerNota(n.id)}>Apagar</button></div>)}
      <h3>Histórico de atendimentos</h3>
      {selecionado.historico.map((a) => <div className="list-row" key={a.id}><div className="list-main"><p className="list-title">{dataBR(a.data)} · {a.hora} · {a.servico}</p><p className="list-meta">{a.barbeiro} · {a.forma ?? 'Pagamento pendente'}</p></div><span className="status-tag" data-status={a.status}>{a.status} · {brl(a.valor)}</span></div>)}
    </Cartao>}
  </>
}

export function AdminAgendamentos() {
  const [agendamentos, setAgendamentos] = useState<Ag[]>([])
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
  const [nomes, setNomes] = useState<{ barbeiros: { id: number; nome: string }[]; servicos: { id: number; nome: string }[] }>({ barbeiros: [], servicos: [] })
  const [data, setData] = useState('')
  const [barberId, setBarberId] = useState('')
  const [status, setStatus] = useState('')
  const [forma, setForma] = useState('pix')
  const [msg, setMsg] = useState('')
  const carregar = useCallback(async () => {
    const [a, c, b, s] = await Promise.all([
      api<{ agendamentos: Ag[] }>('/api/agendamentos'), api<Catalogo>('/api/catalogo'),
      api<{ barbeiros: { id: number; nome: string }[] }>('/api/admin/barbeiros'), api<{ servicos: { id: number; nome: string }[] }>('/api/admin/servicos'),
    ])
    if (a.ok && a.data) setAgendamentos(a.data.agendamentos)
    if (c.ok && c.data) setCatalogo(c.data)
    setNomes({ barbeiros: b.ok && b.data ? b.data.barbeiros : [], servicos: s.ok && s.data ? s.data.servicos : [] })
  }, [])
  useEffect(() => { carregar() }, [carregar])
  const lista = agendamentos.filter((a) => (!data || a.data === data) && (!barberId || String(a.barberId) === barberId) && (!status || a.status === status)).sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))
  async function mudar(a: Ag, next: string) {
    setMsg('')
    const r = await api<{ erro?: string }>(`/api/agendamentos/${a.id}`, { method: 'PATCH', body: JSON.stringify({ status: next, formaPagamento: next === 'concluido' ? forma : undefined }) })
    if (!r.ok) setMsg(erroApi(r.data, 'Não foi possível atualizar o atendimento.')); else carregar()
  }
  const nome = (items: { id: number; nome: string }[] | undefined, id: number) => items?.find((x) => x.id === id)?.nome ?? '—'
  return <Cartao titulo="Todos os agendamentos">
    <div className="filter-row">
      <label>Data<input className={campo} type="date" value={data} onChange={(e) => setData(e.target.value)} /></label>
      <label>Barbeiro<select className={campo} value={barberId} onChange={(e) => setBarberId(e.target.value)}><option value="">Todos</option>{catalogo?.barbeiros.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}</select></label>
      <label>Status<select className={campo} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos</option>{[['agendado', 'Agendado'], ['concluido', 'Concluído'], ['faltou', 'Faltou'], ['cancelado', 'Cancelado']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
      <label>Pagamento ao concluir<select className={campo} value={forma} onChange={(e) => setForma(e.target.value)}>{[['pix', 'Pix'], ['dinheiro', 'Dinheiro'], ['debito', 'Débito'], ['credito', 'Crédito']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
      <button className={botaoSec} onClick={() => { setData(''); setBarberId(''); setStatus('') }}>Limpar filtros</button>
    </div>
    {msg && <p className="error" role="alert">{msg}</p>}
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Data e hora</th><th>Cliente</th><th>Telefone</th><th>Barbeiro</th><th>Serviço</th><th>Valor</th><th>Status</th><th>Ação</th></tr></thead><tbody>
      {lista.map((a) => <tr key={a.id}><td>{dataBR(a.data)} · {a.hora}</td><td>{a.clienteNome ?? '—'}</td><td>{a.clienteTel ?? '—'}</td><td>{nome(nomes.barbeiros, a.barberId)}</td><td>{nome(nomes.servicos, a.servicoId)}</td><td>{brl(a.preco)}</td><td><span className="status-tag" data-status={a.status}>{a.status}</span></td><td>{a.status === 'agendado' ? <div className="inline-row"><button className={botaoSec} onClick={() => mudar(a, 'concluido')}>Concluir</button><button className="button button-danger" onClick={() => confirm('Cancelar este agendamento?') && mudar(a, 'cancelado')}>Cancelar</button></div> : a.status === 'faltou' ? <button className={botaoSec} onClick={() => mudar(a, 'agendado')}>Reabrir</button> : '—'}</td></tr>)}
      {lista.length === 0 && <tr><td colSpan={8} className="muted">Nenhum agendamento com esses filtros.</td></tr>}
    </tbody></table></div>
  </Cartao>
}

export function AdminAgenda() {
  const [dia, setDia] = useState(hojeBR())
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
  const [agendamentos, setAgendamentos] = useState<Ag[]>([])
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([])
  const [clientes, setClientes] = useState<{ id: number; nome: string; telefone: string }[]>([])
  const [servicoId, setServicoId] = useState('')
  const [barberId, setBarberId] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [clienteNome, setClienteNome] = useState('')
  const [clienteTelefone, setClienteTelefone] = useState('')
  const [clienteEmail, setClienteEmail] = useState('')
  const [consentimento, setConsentimento] = useState(false)
  const [hora, setHora] = useState('')
  const [disponiveis, setDisponiveis] = useState<string[]>([])
  const [reservaMsg, setReservaMsg] = useState('')
  useEffect(() => {
    Promise.all([api<Catalogo>('/api/catalogo'), api<{ agendamentos: Ag[] }>('/api/agendamentos'), api<{ bloqueios: Bloqueio[] }>('/api/bloqueios')]).then(([c, a, b]) => {
      if (c.ok && c.data) setCatalogo(c.data)
      if (a.ok && a.data) setAgendamentos(a.data.agendamentos)
      if (b.ok && b.data) setBloqueios(b.data.bloqueios)
    })
    api<{ clientes: { id: number; nome: string; telefone: string }[] }>('/api/clientes').then((r) => r.ok && r.data && setClientes(r.data.clientes))
  }, [])
  useEffect(() => {
    setHora(''); setDisponiveis([])
    if (!servicoId || !barberId || !dia) return
    let vivo = true
    api<{ horarios: string[] }>(`/api/disponibilidade?barberId=${barberId}&servicoId=${servicoId}&data=${dia}`).then((r) => { if (vivo && r.ok && r.data) setDisponiveis(r.data.horarios) })
    return () => { vivo = false }
  }, [servicoId, barberId, dia])
  async function agendarBalcao(e: FormEvent) {
    e.preventDefault(); setReservaMsg('')
    let idCliente = Number(clienteId)
    if (clienteId === 'novo') {
      if (!consentimento) return setReservaMsg('Confirme que o cliente autorizou o cadastro dos dados.')
      const cadastro = await api<{ cliente?: { id: number; nome: string; telefone: string }; erro?: string }>('/api/clientes', { method: 'POST', body: JSON.stringify({ nome: clienteNome, telefone: clienteTelefone, email: clienteEmail || undefined }) })
      if (!cadastro.ok || !cadastro.data?.cliente) return setReservaMsg(erroApi(cadastro.data, 'Não foi possível cadastrar o cliente.'))
      idCliente = cadastro.data.cliente.id
      setClientes((anteriores) => [cadastro.data!.cliente!, ...anteriores.filter((c) => c.id !== cadastro.data!.cliente!.id)])
      setClienteId(String(idCliente))
    }
    const r = await api<{ erro?: string }>('/api/agendamentos', { method: 'POST', body: JSON.stringify({ servicoId: Number(servicoId), barberId: Number(barberId), clienteId: idCliente, data: dia, hora }) })
    if (!r.ok) return setReservaMsg(erroApi(r.data, 'Não foi possível criar o agendamento.'))
    setReservaMsg('Agendamento criado.'); setHora('')
    setClienteId(''); setClienteNome(''); setClienteTelefone(''); setClienteEmail(''); setConsentimento(false)
    const c = await api<{ clientes: { id: number; nome: string; telefone: string }[] }>('/api/clientes')
    if (c.ok && c.data) setClientes(c.data.clientes)
    const a = await api<{ agendamentos: Ag[] }>('/api/agendamentos')
    if (a.ok && a.data) setAgendamentos(a.data.agendamentos)
    const livre = await api<{ horarios: string[] }>(`/api/disponibilidade?barberId=${barberId}&servicoId=${servicoId}&data=${dia}`)
    if (livre.ok && livre.data) setDisponiveis(livre.data.horarios)
  }
  const h = catalogo?.horario
  const slots: number[] = []
  if (h) for (let n = minutos(h.abre); n < minutos(h.fecha); n += 30) slots.push(n)
  const itemEm = (bid: number, n: number) => agendamentos.find((a) => a.barberId === bid && a.data === dia && a.status !== 'cancelado' && n >= minutos(a.hora) && n < minutos(a.hora) + a.dur)
  const bloqueioEm = (bid: number, n: number) => bloqueios.find((b) => b.barberId === bid && b.data === dia && n >= minutos(b.ini) && n < minutos(b.fim))
  return <Cartao titulo="Agenda da equipe">
    <div className="inline-row agenda-controls"><button className={botaoSec} aria-label="Dia anterior" onClick={() => setDia(somaDias(dia, -1))}>←</button><input className={campo} type="date" value={dia} onChange={(e) => setDia(e.target.value)} /><button className={botaoSec} aria-label="Próximo dia" onClick={() => setDia(somaDias(dia, 1))}>→</button><button className={botaoSec} onClick={() => setDia(hojeBR())}>Hoje</button><span className="muted">{dataBR(dia)}</span></div>
    <details className="quick-book"><summary>Agendar no balcão</summary><form className="module-form" onSubmit={agendarBalcao}>
      <label>Cliente<select className={campo} value={clienteId} onChange={(e) => setClienteId(e.target.value)} required><option value="">Selecione um cliente</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome} · {c.telefone}</option>)}<option value="novo">Cadastrar novo cliente</option></select></label>
      {clienteId === 'novo' && <>
        <label>Nome completo<input className={campo} value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} required /></label>
        <label>Telefone<input className={campo} inputMode="tel" value={clienteTelefone} onChange={(e) => setClienteTelefone(e.target.value)} required /></label>
        <label>E-mail (opcional)<input className={campo} type="email" value={clienteEmail} onChange={(e) => setClienteEmail(e.target.value)} /></label>
        <label className="check-label"><input type="checkbox" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} /> Cliente autorizou o cadastro desses dados.</label>
      </>}
      <label>Serviço<select className={campo} value={servicoId} onChange={(e) => setServicoId(e.target.value)} required><option value="">Selecione um serviço</option>{catalogo?.servicos.map((s) => <option key={s.id} value={s.id}>{s.nome} · {brl(s.preco)}</option>)}</select></label>
      <label>Barbeiro<select className={campo} value={barberId} onChange={(e) => setBarberId(e.target.value)} required><option value="">Selecione um barbeiro</option>{catalogo?.barbeiros.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}</select></label>
      <label>Horário<select className={campo} value={hora} onChange={(e) => setHora(e.target.value)} required><option value="">Selecione um horário</option>{disponiveis.map((h) => <option key={h} value={h}>{h}</option>)}</select></label>
      {reservaMsg && <p className="muted" role="status">{reservaMsg}</p>}
      <div className="inline-row"><button className={botao} disabled={!clienteId || !servicoId || !barberId || !hora || (clienteId === 'novo' && (!clienteNome.trim() || !clienteTelefone.trim() || !consentimento))}>Confirmar agendamento</button></div>
    </form></details>
    {!catalogo ? <p className="muted">Carregando agenda...</p> : <div className="table-wrap"><table className="data-table calendar-table"><thead><tr><th>Hora</th>{catalogo.barbeiros.map((b) => <th key={b.id}>{b.nome}</th>)}</tr></thead><tbody>
      {slots.map((n) => <tr key={n}><th>{horaTxt(n)}</th>{catalogo.barbeiros.map((b) => {
        const ag = itemEm(b.id, n); const bloqueio = !ag && bloqueioEm(b.id, n); const isInicio = ag?.hora === horaTxt(n)
        const weekday = new Date(`${dia}T12:00:00Z`).getUTCDay()
        const fechado = !catalogo.horario.dias.includes(weekday)
        const almoco = !ag && !bloqueio && catalogo.horario.almocoIni !== null && catalogo.horario.almocoFim !== null && n >= minutos(catalogo.horario.almocoIni) && n < minutos(catalogo.horario.almocoFim)
        return <td key={b.id} className={ag ? 'calendar-booked' : bloqueio || fechado || almoco ? 'calendar-blocked' : ''}>{ag ? isInicio ? <><strong>{ag.clienteNome || 'Cliente'}</strong><small>{ag.hora} · {ag.dur} min · {brl(ag.preco)}</small></> : <span className="muted">continua</span> : bloqueio ? <><strong>Bloqueado</strong><small>{bloqueio.motivo || 'Indisponível'}</small></> : fechado ? <span className="muted">Fechado</span> : almoco ? <span className="muted">Almoço</span> : <span className="calendar-free">Livre</span>}</td>
      })}</tr>)}
      {slots.length === 0 && <tr><td colSpan={(catalogo.barbeiros.length || 0) + 1} className="muted">Não há barbeiros ou horários configurados.</td></tr>}
    </tbody></table></div>}
  </Cartao>
}

export function BarbeiroBloqueios() {
  const [itens, setItens] = useState<Bloqueio[]>([])
  const [dia, setDia] = useState(hojeBR())
  const [inicio, setInicio] = useState('12:00')
  const [fim, setFim] = useState('13:00')
  const [motivo, setMotivo] = useState('')
  const [msg, setMsg] = useState('')
  const carregar = useCallback(async () => { const r = await api<{ bloqueios: Bloqueio[] }>('/api/bloqueios'); if (r.ok && r.data) setItens(r.data.bloqueios) }, [])
  useEffect(() => { carregar() }, [carregar])
  async function salvar(e: FormEvent) {
    e.preventDefault(); setMsg('')
    const r = await api<{ erro?: string }>('/api/bloqueios', { method: 'POST', body: JSON.stringify({ data: dia, ini: inicio, fim, motivo: motivo.trim() }) })
    if (!r.ok) return setMsg(erroApi(r.data, 'Não foi possível criar o bloqueio.'))
    setMsg('Período bloqueado.'); setMotivo(''); carregar()
  }
  async function remover(k: Bloqueio) {
    if (!confirm(`Remover o bloqueio de ${dataBR(k.data)} das ${k.ini} às ${k.fim}?`)) return
    const r = await api<{ erro?: string }>(`/api/bloqueios/${k.id}`, { method: 'DELETE' })
    if (!r.ok) setMsg(erroApi(r.data, 'Não foi possível remover o bloqueio.')); else { setMsg('Bloqueio removido.'); carregar() }
  }
  return <Cartao titulo="Bloqueios de agenda">
    <form className="module-form" onSubmit={salvar}>
      <label>Data<input className={campo} type="date" value={dia} min={hojeBR()} onChange={(e) => setDia(e.target.value)} required /></label>
      <label>Início<input className={campo} type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} required /></label>
      <label>Fim<input className={campo} type="time" value={fim} onChange={(e) => setFim(e.target.value)} required /></label>
      <label>Motivo<input className={campo} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Almoço, folga..." maxLength={60} /></label>
      <div className="inline-row"><button className={botao}>Bloquear período</button></div>
    </form>
    {msg && <p className="muted" role="status">{msg}</p>}
    {itens.length === 0 ? <p className="empty-state">Nenhum bloqueio futuro.</p> : itens.map((k) => <div key={k.id} className="list-row"><div className="list-main"><p className="list-title">{dataBR(k.data)} · {k.ini}–{k.fim}</p><p className="list-meta">{k.motivo || 'Indisponível'}</p></div><button className="button button-danger" onClick={() => remover(k)}>Remover</button></div>)}
  </Cartao>
}

export function BarbeiroClientes() {
  const usuarioId = useAuth((s) => s.usuario?.id)
  const [query, setQuery] = useState('')
  const [busca, setBusca] = useState('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [selecionado, setSelecionado] = useState<DetalheCliente | null>(null)
  const [nota, setNota] = useState('')
  const [msg, setMsg] = useState('')
  const carregar = useCallback(async () => {
    const r = await api<{ clientes: Cliente[] }>(`/api/clientes?q=${encodeURIComponent(busca)}`)
    if (r.ok && r.data) setClientes(r.data.clientes)
  }, [busca])
  useEffect(() => { carregar() }, [carregar])
  async function abrir(id: number) {
    const r = await api<DetalheCliente>(`/api/clientes/${id}`)
    if (r.ok && r.data) { setSelecionado(r.data); setMsg('') }
    else setMsg(erroApi(r.data, 'Não foi possível abrir a ficha.'))
  }
  async function salvarNota(e: FormEvent) {
    e.preventDefault(); if (!selecionado || !nota.trim()) return
    const r = await api<{ erro?: string }>(`/api/clientes/${selecionado.cliente.id}/notas`, { method: 'POST', body: JSON.stringify({ texto: nota }) })
    if (!r.ok) return setMsg(erroApi(r.data, 'Não foi possível salvar a observação.'))
    setNota(''); abrir(selecionado.cliente.id)
  }
  async function removerNota(notaId: number) {
    if (!selecionado) return
    const r = await api<{ erro?: string }>(`/api/clientes/${selecionado.cliente.id}/notas?notaId=${notaId}`, { method: 'DELETE' })
    if (!r.ok) setMsg(erroApi(r.data, 'Só o autor da observação pode removê-la.')); else abrir(selecionado.cliente.id)
  }
  return <>
    <Cartao titulo="Clientes atendidos">
      <form className="inline-row" onSubmit={(e) => { e.preventDefault(); setBusca(query.trim()) }}><input className={campo} placeholder="Buscar por nome ou telefone" value={query} onChange={(e) => setQuery(e.target.value)} /><button className={botaoSec}>Buscar</button></form>
      {msg && !selecionado && <p className="error" role="alert">{msg}</p>}
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Nome</th><th>Telefone</th><th>Visitas</th><th>Faltas</th><th>Última visita</th><th></th></tr></thead><tbody>
        {clientes.map((c) => <tr key={c.id}><td>{c.nome}</td><td>{c.telefone || '—'}</td><td>{c.visitas}</td><td>{c.faltas}</td><td>{c.ultimoAtendimento ? dataBR(c.ultimoAtendimento) : '—'}</td><td><button className={botaoSec} onClick={() => abrir(c.id)}>Ver ficha</button></td></tr>)}
        {clientes.length === 0 && <tr><td colSpan={6} className="muted">Nenhum cliente encontrado.</td></tr>}
      </tbody></table></div>
    </Cartao>
    {selecionado && <Cartao titulo={`Ficha de ${selecionado.cliente.nome}`}>
      <div className="inline-row ficha-summary"><span>{selecionado.cliente.telefone}</span><span>{selecionado.resumo.visitas} visitas</span><span>{selecionado.resumo.faltas} faltas</span><button className={botaoSec} onClick={() => setSelecionado(null)}>Fechar ficha</button></div>
      <h3>Observações internas</h3><p className="muted">Visíveis apenas para a equipe. Não registre dados sensíveis.</p>
      <form className="inline-row" onSubmit={salvarNota}><input className={campo} placeholder="Ex.: prefere degradê baixo" value={nota} maxLength={500} onChange={(e) => setNota(e.target.value)} /><button className={botao}>Adicionar observação</button></form>
      {msg && <p className="error" role="alert">{msg}</p>}
      {selecionado.notas.map((n) => <div className="list-row" key={n.id}><div className="list-main"><p className="list-title">{n.texto}</p><p className="list-meta">{n.autorNome} · {new Date(n.criadaEm).toLocaleDateString('pt-BR')}</p></div>{n.autorId === usuarioId && <button className="button button-danger" onClick={() => removerNota(n.id)}>Apagar</button>}</div>)}
      <h3>Histórico de atendimentos</h3>
      {selecionado.historico.map((a) => <div className="list-row" key={a.id}><div className="list-main"><p className="list-title">{dataBR(a.data)} · {a.hora} · {a.servico}</p><p className="list-meta">{a.barbeiro} · {a.forma ?? 'Pagamento pendente'}</p></div><span className="status-tag" data-status={a.status}>{a.status} · {brl(a.valor)}</span></div>)}
    </Cartao>}
  </>
}
