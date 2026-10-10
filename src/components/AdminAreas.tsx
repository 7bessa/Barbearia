'use client'
import { FormEvent, useCallback, useEffect, useState, type CSSProperties } from 'react'
import Image from 'next/image'
import { api } from '@/lib/api-client'
import { Cartao, botao, botaoSec, brl, campo, dataBR, hojeBR, somaDias } from '@/components/Shell'
import { useAuth } from '@/store/auth'
import { normalizarSlug } from '@/lib/slug-barbearia'

type Barbeiro = { id: number; nome: string; foto: string; comissao: number; ativo: boolean; temLogin?: boolean }
type Servico = { id: number; nome: string; preco: number; dur: number; ativo: boolean }
type Cliente = { id: number; nome: string; telefone: string; email?: string; semConta?: boolean; visitas: number; faltas: number; ultimoAtendimento: string | null; totalGasto?: number }
type DetalheCliente = {
  cliente: { id: number; nome: string; telefone: string; email?: string; semConta: boolean }
  resumo: { visitas: number; faltas: number; cancelados: number; ultimoAtendimento: string | null; totalGasto?: number }
  historico: { id: number; data: string; hora: string; status: string; valor: number; forma: string | null; servico: string; barbeiro: string }[]
  notas: { id: number; autorId: number; autorNome: string; texto: string; criadaEm: string }[]
}
type Ag = { id: number; data: string; hora: string; servicoId: number; barberId: number; dur: number; preco: number; cadeira?: number; status: string; clienteId?: number; clienteNome?: string; clienteTel?: string; forma?: string | null }
type Catalogo = { barbeiros: { id: number; nome: string }[]; servicos: { id: number; nome: string; preco: number; dur: number }[]; horario: Horario; barbearia?: { capacidadeCadeiras: number } }
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
  const [foto, setFoto] = useState('')
  const [comissao, setComissao] = useState('40')
  const [ativo, setAtivo] = useState(true)
  const [msg, setMsg] = useState('')
  const carregar = useCallback(async () => { const r = await api<{ barbeiros: Barbeiro[] }>('/api/admin/barbeiros'); if (r.ok && r.data) setItens(r.data.barbeiros) }, [])
  useEffect(() => { carregar() }, [carregar])
  const limpar = () => { setEditando(null); setNome(''); setFoto(''); setComissao('40'); setAtivo(true) }
  const editar = (b: Barbeiro) => { setEditando(b.id); setNome(b.nome); setFoto(b.foto); setComissao(String(b.comissao)); setAtivo(b.ativo) }
  async function salvar(e: FormEvent) {
    e.preventDefault(); setMsg('')
    const body = JSON.stringify({ nome: nome.trim(), foto: foto.trim(), comissao: Number(comissao), ativo })
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
      <label>Foto do profissional (link HTTPS)<input className={campo} type="url" value={foto} onChange={(e) => setFoto(e.target.value)} maxLength={2048} placeholder="https://..." /></label>
      <label>Comissão (%)<input className={campo} type="number" min="0" max="100" step="1" value={comissao} onChange={(e) => setComissao(e.target.value)} required /></label>
      {editando !== null && <label className="check-label"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Profissional ativo</label>}
      <div className="inline-row"><button className={botao}>{editando ? 'Salvar alterações' : 'Cadastrar profissional'}</button>{editando !== null && <button type="button" className={botaoSec} onClick={limpar}>Cancelar edição</button>}</div>
    </form>
    {msg && <p className="muted" role="status">{msg}</p>}
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Nome</th><th>Comissão</th><th>Acesso</th><th>Status</th><th>Ações</th></tr></thead><tbody>
      {itens.map((b) => <tr key={b.id}><td><span className="barber-list-name">{b.foto ? <Image className="barber-list-photo" src={b.foto} alt="" width={30} height={30} unoptimized={!b.foto.startsWith('/')} /> : <span className="barber-photo-fallback barber-list-fallback" aria-hidden="true">{b.nome.slice(0, 1)}</span>}{b.nome}</span></td><td>{b.comissao}%</td><td>{b.temLogin ? 'Conta ativa' : 'Sem login'}</td><td><span className="status-tag" data-status={b.ativo ? 'concluido' : 'cancelado'}>{b.ativo ? 'Ativo' : 'Inativo'}</span></td><td><div className="inline-row"><button className={botaoSec} onClick={() => editar(b)}>Editar</button><button className="button button-danger" onClick={() => remover(b)}>Remover</button></div></td></tr>)}
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
      <div className="inline-row"><button className={botao}>{editando ? 'Salvar alterações' : 'Cadastrar serviço'}</button>{editando !== null && <button type="button" className={botaoSec} onClick={limpar}>Cancelar edição</button>}</div>
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

type Marca = { id: number; nome: string; slogan: string; slug: string; corPrimaria: string; corFundo: string; imagemAmbiente: string; capacidadeCadeiras: number; plano: string; assinaturaStatus: string; testeAte: string | null }
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
      setMarca({ ...r.data.barbearia, corPrimaria: corHex(r.data.barbearia.corPrimaria, '#D4AF37'), corFundo: corHex(r.data.barbearia.corFundo, '#0A0A0A') })
    } else setMsg(erroApi(r.data, 'Não foi possível carregar a identidade da barbearia.'))
    setCarregando(false)
  }, [])
  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { setOrigem(window.location.origin) }, [])

  const link = marca ? `${origem}/agendar/${marca.slug}` : ''
  const imagemPreview = marca?.imagemAmbiente === '/barbershop-ambient.png' ? '/barbershop-ambient.webp' : marca?.imagemAmbiente
  const estilo = marca ? { '--brand-preview-bg': marca.corFundo, '--brand-preview-accent': marca.corPrimaria } as CSSProperties : undefined
  function alterar(chave: keyof Marca, valor: string | number) { setMarca((atual) => atual ? { ...atual, [chave]: valor } : atual) }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    if (!marca) return
    setMsg('')
    setSalvando(true)
    const r = await api<{ barbearia?: Marca; erro?: string }>('/api/admin/barbearia', {
      method: 'PUT',
      body: JSON.stringify({ nome: marca.nome, slogan: marca.slogan, slug: marca.slug, corPrimaria: marca.corPrimaria, corFundo: marca.corFundo, imagemAmbiente: marca.imagemAmbiente, capacidadeCadeiras: marca.capacidadeCadeiras }),
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
      <div className="list-row"><div className="list-main"><p className="list-title">Plano {marca.plano === 'profissional' ? 'Profissional' : 'Essencial'}</p><p className="list-meta">{marca.assinaturaStatus === 'teste' && marca.testeAte ? `Teste ativo até ${new Date(marca.testeAte).toLocaleDateString('pt-BR')}` : marca.assinaturaStatus === 'ativa' ? 'Assinatura ativa' : `Assinatura ${marca.assinaturaStatus}`}</p></div><span className="status-tag" data-status={marca.assinaturaStatus === 'ativa' || marca.assinaturaStatus === 'teste' ? 'concluido' : 'faltou'}>{marca.assinaturaStatus === 'teste' ? 'Teste' : marca.assinaturaStatus}</span></div>
      <div className="module-form">
        <label>Nome da barbearia<input className={campo} value={marca.nome} maxLength={70} onChange={(e) => alterar('nome', e.target.value)} required /></label>
        <label>Frase curta<input className={campo} value={marca.slogan} maxLength={100} onChange={(e) => alterar('slogan', e.target.value)} /></label>
        <label>Endereço do link<input className={campo} value={marca.slug} maxLength={48} autoCapitalize="none" autoCorrect="off" onChange={(e) => alterar('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-'))} required /></label>
        <label>Foto do ambiente (link HTTPS)<input className={campo} type="url" value={marca.imagemAmbiente} maxLength={2048} placeholder="https://..." onChange={(e) => alterar('imagemAmbiente', e.target.value)} /></label>
        <label>Cadeiras em operação<input className={campo} type="number" min="1" max="30" value={marca.capacidadeCadeiras} onChange={(e) => alterar('capacidadeCadeiras', Number(e.target.value))} required /></label>
        <label className="brand-color-field">Cor principal<input type="color" value={marca.corPrimaria} onChange={(e) => alterar('corPrimaria', e.target.value)} /></label>
        <label className="brand-color-field">Cor de fundo<input type="color" value={marca.corFundo} onChange={(e) => alterar('corFundo', e.target.value)} /></label>
      </div>
      <button type="button" className={botaoSec} onClick={() => alterar('slug', normalizarSlug(marca.nome))}>Gerar endereço pelo nome</button>
      <div className="brand-preview" style={estilo}><span>AGENDAMENTO ONLINE</span><strong>{marca.nome || 'Sua barbearia'}</strong><small>{marca.slogan || 'Escolha seu serviço e horário.'}</small></div>
      {imagemPreview && <Image className="brand-ambient-preview" src={imagemPreview} alt="Prévia do ambiente da barbearia" width={520} height={228} unoptimized={!imagemPreview.startsWith('/')} />}
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
      <form className="inline-row" onSubmit={salvarNota}><input className={campo} placeholder="Ex.: prefere degradê baixo" value={nota} maxLength={500} onChange={(e) => setNota(e.target.value)} /><button className={botao}>Anotar preferência</button></form>
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
  const [faltasPorCliente, setFaltasPorCliente] = useState<Record<number, number>>({})
  const [data, setData] = useState('')
  const [barberId, setBarberId] = useState('')
  const [status, setStatus] = useState('')
  const [forma, setForma] = useState('pix')
  const [baixaId, setBaixaId] = useState<number | null>(null)
  const [produtos, setProdutos] = useState<{ id: number; nome: string; preco: number; quantidade: number; ativo: boolean }[]>([])
  const [produtoId, setProdutoId] = useState('')
  const [adicionalDescricao, setAdicionalDescricao] = useState('')
  const [adicionalValor, setAdicionalValor] = useState('')
  const [msg, setMsg] = useState('')
  const [erroCarga, setErroCarga] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [processandoId, setProcessandoId] = useState<number | null>(null)
  const carregar = useCallback(async () => {
    setCarregando(true)
    setErroCarga('')
    try {
      const [a, c, b, s, clientes, p] = await Promise.all([
        api<{ agendamentos: Ag[] }>(`/api/agendamentos${data ? `?data=${encodeURIComponent(data)}` : ''}`), api<Catalogo>('/api/catalogo'),
        api<{ barbeiros: { id: number; nome: string }[] }>('/api/admin/barbeiros'), api<{ servicos: { id: number; nome: string }[] }>('/api/admin/servicos'),
        api<{ clientes: { id: number; faltas: number }[] }>('/api/clientes'),
        api<{ produtos: { id: number; nome: string; preco: number; quantidade: number; ativo: boolean }[] }>('/api/admin/produtos'),
      ])
      if (a.ok && a.data) setAgendamentos(a.data.agendamentos)
      if (c.ok && c.data) setCatalogo(c.data)
      if (b.ok && b.data && s.ok && s.data) setNomes({ barbeiros: b.data.barbeiros, servicos: s.data.servicos })
      if (clientes.ok && clientes.data) setFaltasPorCliente(Object.fromEntries(clientes.data.clientes.map((cliente) => [cliente.id, cliente.faltas])))
      if (p.ok && p.data) setProdutos(p.data.produtos)
      if (![a, c, b, s, clientes, p].every((resposta) => resposta.ok)) setErroCarga('Alguns dados da agenda não carregaram. Tente atualizar antes de concluir um atendimento.')
    } finally {
      setCarregando(false)
    }
  }, [data])
  useEffect(() => { carregar() }, [carregar])
  const lista = agendamentos.filter((a) => (!data || a.data === data) && (!barberId || String(a.barberId) === barberId) && (!status || a.status === status)).sort((a, b) => (a.data + a.hora).localeCompare(b.data + b.hora))
  async function mudar(a: Ag, next: string, incluirAdicional = false) {
    if (processandoId !== null) return
    setMsg('')
    const produto = produtos.find((item) => item.id === Number(produtoId))
    const itens = incluirAdicional && produto ? [{ descricao: produto.nome, quantidade: 1, valorUnitario: produto.preco, produtoId: produto.id }] : incluirAdicional && adicionalDescricao.trim() && Number(adicionalValor) > 0 ? [{ descricao: adicionalDescricao.trim(), quantidade: 1, valorUnitario: Number(adicionalValor) }] : undefined
    setProcessandoId(a.id)
    try {
      const r = await api<{ erro?: string }>(`/api/agendamentos/${a.id}`, { method: 'PATCH', body: JSON.stringify({ status: next, formaPagamento: next === 'concluido' ? forma : undefined, itens }) })
      if (!r.ok) setMsg(erroApi(r.data, 'Não foi possível atualizar o atendimento.'))
      else { setBaixaId(null); setProdutoId(''); setAdicionalDescricao(''); setAdicionalValor(''); await carregar() }
    } finally {
      setProcessandoId(null)
    }
  }
  const nome = (items: { id: number; nome: string }[] | undefined, id: number) => items?.find((x) => x.id === id)?.nome ?? '—'
  const lembrete = (a: Ag) => {
    const telefone = (a.clienteTel ?? '').replace(/\D/g, '')
    if (!telefone) return ''
    const destino = telefone.length <= 11 ? `55${telefone}` : telefone
    const texto = `Olá, ${a.clienteNome ?? ''}! Lembrando do seu horário na barbearia em ${dataBR(a.data)} às ${a.hora}. Pode confirmar sua presença?`
    return `https://wa.me/${destino}?text=${encodeURIComponent(texto)}`
  }
  return <Cartao titulo="Todos os agendamentos">
    <div className="filter-row">
      <label>Data<input className={campo} type="date" value={data} onChange={(e) => setData(e.target.value)} /></label>
      <label>Barbeiro<select className={campo} value={barberId} onChange={(e) => setBarberId(e.target.value)}><option value="">Todos</option>{catalogo?.barbeiros.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}</select></label>
      <label>Status<select className={campo} value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos</option>{[['agendado', 'Agendado'], ['concluido', 'Concluído'], ['faltou', 'Faltou'], ['cancelado', 'Cancelado']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
      <label>Pagamento ao concluir<select className={campo} value={forma} onChange={(e) => setForma(e.target.value)}>{[['pix', 'Pix'], ['dinheiro', 'Dinheiro'], ['debito', 'Débito'], ['credito', 'Crédito']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>
      <button className={botaoSec} onClick={() => { setData(''); setBarberId(''); setStatus('') }}>Limpar filtros</button>
    </div>
    {msg && <p className="error" role="alert">{msg}</p>}
    {erroCarga && <div><p className="error" role="alert">{erroCarga}</p><button type="button" className={botaoSec} onClick={carregar}>Atualizar agenda</button></div>}
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Data e hora</th><th>Cliente</th><th>Telefone</th><th>Barbeiro</th><th>Serviço</th><th>Valor</th><th>Status</th><th>Ação</th></tr></thead><tbody>
      {lista.map((a) => { const faltas = a.clienteId ? faltasPorCliente[a.clienteId] ?? 0 : 0; const linkLembrete = lembrete(a); const baixando = baixaId === a.id; return <tr key={a.id}><td>{dataBR(a.data)} · {a.hora}</td><td>{a.clienteNome ?? '—'}{faltas >= 2 && <span className="no-show-risk">{faltas} faltas</span>}</td><td>{a.clienteTel ?? '—'}</td><td>{nome(nomes.barbeiros, a.barberId)}</td><td>{nome(nomes.servicos, a.servicoId)}</td><td>{brl(a.preco)}</td><td><span className="status-tag" data-status={a.status}>{a.status}</span></td><td>{a.status === 'agendado' ? baixando ? <div className="module-form"><label>Pagamento<select className={campo} value={forma} onChange={(e) => setForma(e.target.value)}>{[['pix', 'Pix'], ['dinheiro', 'Dinheiro'], ['debito', 'Débito'], ['credito', 'Crédito']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label><label>Produto do estoque (opcional)<select className={campo} value={produtoId} onChange={(e) => setProdutoId(e.target.value)}><option value="">Nenhum produto</option>{produtos.filter((item) => item.ativo && item.quantidade > 0).map((item) => <option key={item.id} value={item.id}>{item.nome} · {brl(item.preco)} · {item.quantidade} un.</option>)}</select></label>{!produtoId && <><label>Produto ou extra avulso (opcional)<input className={campo} value={adicionalDescricao} maxLength={80} placeholder="Ex.: Taxa de barba" onChange={(e) => setAdicionalDescricao(e.target.value)} /></label><label>Valor do extra (R$)<input className={campo} type="number" min="0.01" step="0.01" value={adicionalValor} onChange={(e) => setAdicionalValor(e.target.value)} /></label></>}<div className="inline-row"><button className={botao} onClick={() => mudar(a, 'concluido', true)}>Confirmar pagamento</button><button className={botaoSec} onClick={() => setBaixaId(null)}>Voltar</button></div></div> : <div className="inline-row">{linkLembrete && <a className={botaoSec} href={linkLembrete} target="_blank" rel="noreferrer">Lembrar</a>}<button className={botaoSec} onClick={() => setBaixaId(a.id)}>Dar baixa</button><button className="button button-danger" onClick={() => confirm('Marcar este cliente como falta?') && mudar(a, 'faltou')}>Faltou</button><button className="button button-danger" onClick={() => confirm('Cancelar este agendamento?') && mudar(a, 'cancelado')}>Cancelar</button></div> : a.status === 'faltou' ? <button className={botaoSec} onClick={() => mudar(a, 'agendado')}>Reabrir</button> : '—'}</td></tr> })}
      {lista.length === 0 && <tr><td colSpan={8} className="muted">{carregando ? 'Carregando agendamentos...' : erroCarga ? 'Atualize a agenda para consultar os horários.' : 'Nenhum agendamento com esses filtros.'}</td></tr>}
    </tbody></table></div>
  </Cartao>
}

export function AdminAgenda() {
  const [dia, setDia] = useState(hojeBR())
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
  const [carregandoAgenda, setCarregandoAgenda] = useState(true)
  const [erroAgenda, setErroAgenda] = useState('')
  const [agendamentos, setAgendamentos] = useState<Ag[]>([])
  const [bloqueios, setBloqueios] = useState<Bloqueio[]>([])
  const [clientes, setClientes] = useState<{ id: number; nome: string; telefone: string }[]>([])
  const [buscaCliente, setBuscaCliente] = useState('')
  const [carregandoClientes, setCarregandoClientes] = useState(false)
  const [erroClientes, setErroClientes] = useState('')
  const [quickBookOpen, setQuickBookOpen] = useState(false)
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
  const [salvandoReserva, setSalvandoReserva] = useState(false)
  const [carregandoDisponiveis, setCarregandoDisponiveis] = useState(false)
  const [erroDisponiveis, setErroDisponiveis] = useState(false)
  const [tentativaDisponiveis, setTentativaDisponiveis] = useState(0)
  const [modoAgenda, setModoAgenda] = useState<'barbeiro' | 'cadeira'>('barbeiro')
  const [buscaAgenda, setBuscaAgenda] = useState('')
  const carregarAgenda = useCallback(async () => {
    setCarregandoAgenda(true); setErroAgenda('')
    try {
      const [c, a, b] = await Promise.all([
        api<Catalogo>('/api/catalogo'), api<{ agendamentos: Ag[] }>(`/api/agendamentos?data=${encodeURIComponent(dia)}`),
        api<{ bloqueios: Bloqueio[] }>(`/api/bloqueios?data=${encodeURIComponent(dia)}`),
      ])
      if (c.ok && c.data) setCatalogo(c.data)
      if (a.ok && a.data) setAgendamentos(a.data.agendamentos)
      if (b.ok && b.data) setBloqueios(b.data.bloqueios)
      if (![c, a, b].every((resposta) => resposta.ok)) setErroAgenda('Não foi possível carregar todos os dados da agenda.')
    } finally {
      setCarregandoAgenda(false)
    }
  }, [dia])
  useEffect(() => { carregarAgenda() }, [carregarAgenda])
  useEffect(() => {
    if (!quickBookOpen) return
    let vivo = true
    const timer = window.setTimeout(async () => {
      setCarregandoClientes(true)
      setErroClientes('')
      try {
        const params = new URLSearchParams({ q: buscaCliente, pagina: '1' })
        const r = await api<{ clientes: { id: number; nome: string; telefone: string }[]; erro?: string }>(`/api/clientes?${params}`)
        if (!r.ok || !r.data) throw new Error(r.data?.erro ?? 'Não foi possível buscar clientes.')
        if (vivo) setClientes(r.data.clientes)
      } catch (error) {
        if (vivo) setErroClientes(error instanceof Error ? error.message : 'Não foi possível buscar clientes.')
      } finally {
        if (vivo) setCarregandoClientes(false)
      }
    }, 250)
    return () => { vivo = false; window.clearTimeout(timer) }
  }, [buscaCliente, quickBookOpen])
  useEffect(() => {
    setHora(''); setDisponiveis([])
    setErroDisponiveis(false)
    if (!servicoId || !barberId || !dia) return
    let vivo = true
    setCarregandoDisponiveis(true)
    api<{ horarios: string[] }>(`/api/disponibilidade?barberId=${barberId}&servicoId=${servicoId}&data=${dia}`).then((r) => {
      if (vivo && r.ok && r.data) setDisponiveis(r.data.horarios)
      else if (vivo) setErroDisponiveis(true)
    }).finally(() => { if (vivo) setCarregandoDisponiveis(false) })
    return () => { vivo = false }
  }, [servicoId, barberId, dia, tentativaDisponiveis])
  async function agendarBalcao(e: FormEvent) {
    e.preventDefault(); setReservaMsg(''); setSalvandoReserva(true)
    try {
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
      if (!r.ok) return setReservaMsg(erroApi(r.data, 'Não foi possível confirmar o horário.'))
      setReservaMsg('Agendamento criado.'); setHora('')
      setClienteId(''); setClienteNome(''); setClienteTelefone(''); setClienteEmail(''); setConsentimento(false)
      const a = await api<{ agendamentos: Ag[] }>(`/api/agendamentos?data=${encodeURIComponent(dia)}`)
      if (a.ok && a.data) setAgendamentos(a.data.agendamentos)
      setTentativaDisponiveis((n) => n + 1)
    } catch {
      setReservaMsg('Falha de conexão. Atualize a agenda antes de tentar novamente.')
    } finally {
      setSalvandoReserva(false)
    }
  }
  const h = catalogo?.horario
  const slots: number[] = []
  if (h) for (let n = minutos(h.abre); n < minutos(h.fecha); n += 30) slots.push(n)
  const termoBusca = buscaAgenda.trim().toLocaleLowerCase()
  const telefoneBusca = buscaAgenda.replace(/\D/g, '')
  const agendaDia = agendamentos.filter((a) => a.data === dia && (!termoBusca || (a.clienteNome ?? '').toLocaleLowerCase().includes(termoBusca) || (telefoneBusca.length > 0 && (a.clienteTel ?? '').replace(/\D/g, '').includes(telefoneBusca))))
  const slotsDoDia = [...new Set([...slots, ...agendaDia.map((a) => minutos(a.hora))])].sort((a, b) => a - b)
  const colunas = modoAgenda === 'barbeiro' ? catalogo?.barbeiros.map((b) => ({ id: b.id, nome: b.nome })) ?? [] : Array.from({ length: catalogo?.barbearia?.capacidadeCadeiras ?? 1 }, (_, i) => ({ id: i + 1, nome: `Cadeira ${i + 1}` }))
  const itemEm = (id: number, n: number) => agendaDia.find((a) => (modoAgenda === 'barbeiro' ? a.barberId === id : (a.cadeira ?? 1) === id) && a.status !== 'cancelado' && n >= minutos(a.hora) && n < minutos(a.hora) + a.dur)
  const bloqueioEm = (bid: number, n: number) => bloqueios.find((b) => b.barberId === bid && b.data === dia && n >= minutos(b.ini) && n < minutos(b.fim))
  return <><Cartao titulo="Agenda da equipe">
    <div className="inline-row agenda-controls"><button type="button" className={botaoSec} aria-label="Dia anterior" onClick={() => setDia(somaDias(dia, -1))}>←</button><input className={campo} type="date" value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} /><button type="button" className={botaoSec} aria-label="Próximo dia" onClick={() => setDia(somaDias(dia, 1))}>→</button><button type="button" className={botaoSec} onClick={() => setDia(hojeBR())}>Hoje</button><input className={campo} aria-label="Buscar cliente por nome ou telefone" placeholder="Buscar cliente por nome ou telefone" value={buscaAgenda} onChange={(e) => setBuscaAgenda(e.target.value)} /><div className="segmented"><button type="button" aria-pressed={modoAgenda === 'barbeiro'} onClick={() => setModoAgenda('barbeiro')}>Por barbeiro</button><button type="button" aria-pressed={modoAgenda === 'cadeira'} onClick={() => setModoAgenda('cadeira')}>Por cadeira</button></div><span className="muted">{dataBR(dia)}</span></div>
    <details className="quick-book" open={quickBookOpen} onToggle={(event) => setQuickBookOpen(event.currentTarget.open)}><summary>Agendar no balcão</summary><form className="module-form" onSubmit={agendarBalcao}>
      <label>Buscar cliente por nome ou telefone<input className={campo} value={buscaCliente} onChange={(e) => { setBuscaCliente(e.target.value); setClienteId('') }} placeholder="Digite nome ou telefone" autoComplete="off" /></label>
      <label>Cliente<select className={campo} value={clienteId} onChange={(e) => setClienteId(e.target.value)} required><option value="">{carregandoClientes ? 'Buscando clientes...' : clientes.length ? 'Selecione um cliente' : 'Nenhum cliente encontrado'}</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome} · {c.telefone}</option>)}<option value="novo">Cadastrar novo cliente</option></select></label>
      {erroClientes && <p className="error" role="alert">{erroClientes}</p>}
      {clienteId === 'novo' && <>
        <label>Nome completo<input className={campo} value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} required /></label>
        <label>Telefone<input className={campo} inputMode="tel" value={clienteTelefone} onChange={(e) => setClienteTelefone(e.target.value)} required /></label>
        <label>E-mail (opcional)<input className={campo} type="email" value={clienteEmail} onChange={(e) => setClienteEmail(e.target.value)} /></label>
        <label className="check-label"><input type="checkbox" checked={consentimento} onChange={(e) => setConsentimento(e.target.checked)} /> Cliente autorizou o cadastro desses dados.</label>
      </>}
      <label>Serviço<select className={campo} value={servicoId} onChange={(e) => setServicoId(e.target.value)} required><option value="">Selecione um serviço</option>{catalogo?.servicos.map((s) => <option key={s.id} value={s.id}>{s.nome} · {brl(s.preco)}</option>)}</select></label>
      <label>Barbeiro<select className={campo} value={barberId} onChange={(e) => setBarberId(e.target.value)} required><option value="">Selecione um barbeiro</option>{catalogo?.barbeiros.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}</select></label>
      <label>Horário<select className={campo} value={hora} onChange={(e) => setHora(e.target.value)} required disabled={carregandoDisponiveis || erroDisponiveis || !disponiveis.length}><option value="">{carregandoDisponiveis ? 'Buscando horários...' : erroDisponiveis ? 'Consulta indisponível' : disponiveis.length ? 'Selecione um horário' : 'Sem horários livres'}</option>{disponiveis.map((h) => <option key={h} value={h}>{h}</option>)}</select></label>
      {erroDisponiveis && <div><p className="error" role="alert">Não foi possível consultar os horários disponíveis.</p><button type="button" className={botaoSec} onClick={() => setTentativaDisponiveis((n) => n + 1)}>Tentar novamente</button></div>}
      {reservaMsg && <p className="muted" role="status">{reservaMsg}</p>}
      <div className="inline-row"><button className={botao} disabled={salvandoReserva || !clienteId || !servicoId || !barberId || !hora || (clienteId === 'novo' && (!clienteNome.trim() || !clienteTelefone.trim() || !consentimento))}>{salvandoReserva ? 'Confirmando...' : 'Confirmar agendamento'}</button></div>
    </form></details>
    {erroAgenda ? <div><p className="error" role="alert">{erroAgenda}</p><button type="button" className={botaoSec} onClick={carregarAgenda}>Tentar novamente</button></div> : carregandoAgenda || !catalogo ? <p className="muted">Carregando agenda...</p> : <div className="table-wrap"><table className="data-table calendar-table"><thead><tr><th>Hora</th>{colunas.map((coluna) => <th key={coluna.id}>{coluna.nome}</th>)}</tr></thead><tbody>
      {slotsDoDia.map((n) => <tr key={n}><th>{horaTxt(n)}</th>{colunas.map((coluna) => {
        const ag = itemEm(coluna.id, n); const bloqueio = modoAgenda === 'barbeiro' && !ag ? bloqueioEm(coluna.id, n) : undefined; const isInicio = ag?.hora === horaTxt(n)
        const weekday = new Date(`${dia}T12:00:00Z`).getUTCDay()
        const fechado = !catalogo.horario.dias.includes(weekday)
        const almoco = !ag && !bloqueio && catalogo.horario.almocoIni !== null && catalogo.horario.almocoFim !== null && n >= minutos(catalogo.horario.almocoIni) && n < minutos(catalogo.horario.almocoFim)
        return <td key={coluna.id} className={ag ? 'calendar-booked' : bloqueio || fechado || almoco ? 'calendar-blocked' : ''}>{ag ? isInicio ? <><strong>{ag.clienteNome || 'Cliente'}</strong><small>{ag.hora} · {ag.dur} min · Cadeira {ag.cadeira ?? 1}</small></> : <span className="muted">continua</span> : bloqueio ? <><strong>Bloqueado</strong><small>{bloqueio.motivo || 'Indisponível'}</small></> : fechado ? <span className="muted">Fechado</span> : almoco ? <span className="muted">Almoço</span> : <span className="calendar-free">Livre</span>}</td>
      })}</tr>)}
      {slotsDoDia.length === 0 && <tr><td colSpan={colunas.length + 1} className="muted">Não há barbeiros ou horários configurados.</td></tr>}
    </tbody></table></div>}
  </Cartao><ListaEspera catalogo={catalogo} /></>
}

type Espera = { id: number; clienteNome: string; clienteTel: string; servicoId: number | null; barberId: number | null; data: string | null; preferencia: string; status: 'aguardando' | 'ofertada' | 'preenchida'; vagaData: string | null; vagaHora: string | null }
type CatalogoEspera = { barbeiros: { id: number; nome: string }[]; servicos: { id: number; nome: string }[] }
export function ListaEspera({ catalogo }: { catalogo: CatalogoEspera | null }) {
  const [itens, setItens] = useState<Espera[]>([])
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [servicoId, setServicoId] = useState('')
  const [barberId, setBarberId] = useState('')
  const [data, setData] = useState('')
  const [preferencia, setPreferencia] = useState('')
  const [msg, setMsg] = useState('')
  const [erroCarga, setErroCarga] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [processandoId, setProcessandoId] = useState<number | null>(null)
  const [oferta, setOferta] = useState<{ id: number; data: string; hora: string } | null>(null)
  const carregar = useCallback(async () => {
    setCarregando(true)
    setErroCarga('')
    try {
      const r = await api<{ itens: Espera[]; erro?: string }>('/api/lista-espera')
      if (r.ok && r.data) setItens(r.data.itens)
      else setErroCarga(erroApi(r.data, 'Não foi possível carregar a lista de espera.'))
    } finally {
      setCarregando(false)
    }
  }, [])
  useEffect(() => { carregar() }, [carregar])
  const nomeServico = (id: number | null) => catalogo?.servicos.find((item) => item.id === id)?.nome ?? 'qualquer serviço'
  const nomeBarbeiro = (id: number | null) => catalogo?.barbeiros.find((item) => item.id === id)?.nome ?? 'qualquer profissional'
  async function salvar(e: FormEvent) {
    e.preventDefault(); setMsg(''); setSalvando(true)
    try {
      const r = await api<{ erro?: string }>('/api/lista-espera', { method: 'POST', body: JSON.stringify({ nome, telefone, servicoId: servicoId ? Number(servicoId) : undefined, barberId: barberId ? Number(barberId) : undefined, data: data || undefined, preferencia }) })
      if (!r.ok) return setMsg(erroApi(r.data, 'Não foi possível incluir na lista de espera.'))
      setNome(''); setTelefone(''); setServicoId(''); setBarberId(''); setData(''); setPreferencia(''); setMsg('Cliente incluído na lista de espera.')
      await carregar()
    } finally {
      setSalvando(false)
    }
  }
  async function remover(item: Espera) {
    if (!confirm(`Remover ${item.clienteNome} da lista de espera?`)) return
    setMsg(''); setProcessandoId(item.id)
    try {
      const r = await api<{ erro?: string }>(`/api/lista-espera?id=${item.id}`, { method: 'DELETE' })
      if (!r.ok) return setMsg(erroApi(r.data, 'Não foi possível remover da lista.'))
      setMsg('Cliente removido da lista de espera.')
      await carregar()
    } finally {
      setProcessandoId(null)
    }
  }
  async function salvarOferta(event: FormEvent) {
    event.preventDefault()
    if (!oferta) return
    setMsg(''); setProcessandoId(oferta.id)
    try {
      const r = await api<{ erro?: string }>(`/api/lista-espera?id=${oferta.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'ofertada', vagaData: oferta.data, vagaHora: oferta.hora }) })
      if (!r.ok) return setMsg(erroApi(r.data, 'Não foi possível registrar a vaga.'))
      setOferta(null); setMsg('Vaga registrada. A mensagem está pronta para enviar no WhatsApp.')
      await carregar()
    } finally {
      setProcessandoId(null)
    }
  }
  async function preencher(item: Espera) {
    setMsg(''); setProcessandoId(item.id)
    try {
      const r = await api<{ erro?: string }>(`/api/lista-espera?id=${item.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'preenchida' }) })
      if (!r.ok) return setMsg(erroApi(r.data, 'Não foi possível atualizar a lista.'))
      setMsg('Vaga preenchida e lista atualizada.')
      await carregar()
    } finally {
      setProcessandoId(null)
    }
  }
  const whatsapp = (item: Espera) => {
    const tel = item.clienteTel.replace(/\D/g, ''); if (!tel) return ''
    const destino = tel.length <= 11 ? `55${tel}` : tel
    const quando = item.vagaData && item.vagaHora ? ` em ${dataBR(item.vagaData)} às ${item.vagaHora}` : item.data ? ` em ${dataBR(item.data)}` : ''
    const texto = `Olá, ${item.clienteNome}! Surgiu uma vaga${quando} para ${nomeServico(item.servicoId)} com ${nomeBarbeiro(item.barberId)}. Você quer confirmar este horário?`
    return `https://wa.me/${destino}?text=${encodeURIComponent(texto)}`
  }
  return <Cartao titulo="Lista de espera">
    <form className="module-form" onSubmit={salvar}>
      <label>Nome completo<input className={campo} value={nome} onChange={(e) => setNome(e.target.value)} required /></label><label>WhatsApp<input className={campo} inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} required /></label>
      <label>Serviço<select className={campo} value={servicoId} onChange={(e) => setServicoId(e.target.value)}><option value="">Qualquer serviço</option>{catalogo?.servicos.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
      <label>Profissional<select className={campo} value={barberId} onChange={(e) => setBarberId(e.target.value)}><option value="">Qualquer profissional</option>{catalogo?.barbeiros.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select></label>
      <label>Data desejada<input className={campo} type="date" value={data} onChange={(e) => setData(e.target.value)} /></label><label>Preferência<input className={campo} value={preferencia} maxLength={180} placeholder="Ex.: manhã ou fim de tarde" onChange={(e) => setPreferencia(e.target.value)} /></label>
      <div className="inline-row"><button className={botao} disabled={salvando}>{salvando ? 'Adicionando...' : 'Adicionar à lista'}</button></div>
    </form>
    {msg && <p className="muted" role="status">{msg}</p>}
    {erroCarga ? <div><p className="error" role="alert">{erroCarga}</p><button type="button" className={botaoSec} onClick={carregar}>Tentar novamente</button></div> : carregando ? <p className="muted">Carregando a lista de espera...</p> : itens.length === 0 ? <p className="empty-state">Nenhum cliente aguardando vaga.</p> : itens.map((item) => (
      <div className="list-row" key={item.id}>
        <div className="list-main">
          <p className="list-title">{item.clienteNome} · {nomeServico(item.servicoId)} <span className="status-tag" data-status={item.status === 'preenchida' ? 'concluido' : item.status === 'ofertada' ? 'agendado' : 'faltou'}>{item.status === 'aguardando' ? 'Aguardando vaga' : item.status === 'ofertada' ? 'Vaga oferecida' : 'Preenchida'}</span></p>
          <p className="list-meta">{item.clienteTel} · {item.vagaData && item.vagaHora ? `${dataBR(item.vagaData)} às ${item.vagaHora}` : item.data ? dataBR(item.data) : 'qualquer dia'} · {nomeBarbeiro(item.barberId)}{item.preferencia ? ` · ${item.preferencia}` : ''}</p>
          {oferta?.id === item.id && <form className="inline-row mt-3" onSubmit={salvarOferta}>
            <label>Data da vaga<input className={campo} type="date" min={hojeBR()} required value={oferta.data} onChange={(e) => setOferta({ ...oferta, data: e.target.value })} /></label>
            <label>Horário<input className={campo} type="time" required value={oferta.hora} onChange={(e) => setOferta({ ...oferta, hora: e.target.value })} /></label>
            <button className={botao} disabled={processandoId === item.id}>{processandoId === item.id ? 'Salvando...' : 'Salvar vaga'}</button>
            <button type="button" className={botaoSec} onClick={() => setOferta(null)}>Cancelar</button>
          </form>}
        </div>
        <div className="inline-row">
          {item.status !== 'preenchida' && <button type="button" className={botaoSec} onClick={() => { setOferta({ id: item.id, data: item.vagaData && item.vagaData >= hojeBR() ? item.vagaData : item.data && item.data >= hojeBR() ? item.data : hojeBR(), hora: item.vagaHora ?? '' }); setMsg('') }}>Escolher vaga</button>}
          {item.status === 'ofertada' && <a className={botaoSec} href={whatsapp(item)} target="_blank" rel="noreferrer">Abrir WhatsApp</a>}
          {item.status === 'ofertada' && <button type="button" className={botao} disabled={processandoId === item.id} onClick={() => preencher(item)}>{processandoId === item.id ? 'Atualizando...' : 'Marcar preenchida'}</button>}
          <button type="button" className="button button-danger" disabled={processandoId === item.id} onClick={() => remover(item)}>{processandoId === item.id ? 'Aguarde...' : 'Remover'}</button>
        </div>
      </div>
    ))}
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
    if (!r.ok) return setMsg(erroApi(r.data, 'Não foi possível bloquear este horário.'))
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
      <form className="inline-row" onSubmit={salvarNota}><input className={campo} placeholder="Ex.: prefere degradê baixo" value={nota} maxLength={500} onChange={(e) => setNota(e.target.value)} /><button className={botao}>Anotar preferência</button></form>
      {msg && <p className="error" role="alert">{msg}</p>}
      {selecionado.notas.map((n) => <div className="list-row" key={n.id}><div className="list-main"><p className="list-title">{n.texto}</p><p className="list-meta">{n.autorNome} · {new Date(n.criadaEm).toLocaleDateString('pt-BR')}</p></div>{n.autorId === usuarioId && <button className="button button-danger" onClick={() => removerNota(n.id)}>Apagar</button>}</div>)}
      <h3>Histórico de atendimentos</h3>
      {selecionado.historico.map((a) => <div className="list-row" key={a.id}><div className="list-main"><p className="list-title">{dataBR(a.data)} · {a.hora} · {a.servico}</p><p className="list-meta">{a.barbeiro} · {a.forma ?? 'Pagamento pendente'}</p></div><span className="status-tag" data-status={a.status}>{a.status} · {brl(a.valor)}</span></div>)}
    </Cartao>}
  </>
}
