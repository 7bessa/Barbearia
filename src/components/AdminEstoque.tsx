'use client'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { Cartao, botao, botaoSec, brl, campo } from '@/components/Shell'

type Produto = { id: number; nome: string; preco: number; quantidade: number; estoqueMinimo: number; ativo: boolean }
const vazio = { nome: '', preco: '', quantidade: '0', estoqueMinimo: '0' }

export default function AdminEstoque() {
  const [itens, setItens] = useState<Produto[]>([])
  const [edicao, setEdicao] = useState<number | null>(null)
  const [form, setForm] = useState(vazio)
  const [msg, setMsg] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erroCarga, setErroCarga] = useState('')
  const carregar = useCallback(async () => {
    setCarregando(true); setErroCarga('')
    try {
      const r = await api<{ produtos: Produto[]; erro?: string }>('/api/admin/produtos')
      if (r.ok && r.data) setItens(r.data.produtos)
      else setErroCarga(r.data?.erro ?? 'Não foi possível carregar o estoque.')
    } finally {
      setCarregando(false)
    }
  }, [])
  useEffect(() => { carregar() }, [carregar])
  const mudar = (chave: keyof typeof form, valor: string) => setForm((atual) => ({ ...atual, [chave]: valor }))
  const limpar = () => { setEdicao(null); setForm(vazio) }
  async function salvar(e: FormEvent) {
    e.preventDefault(); setMsg('')
    const body = JSON.stringify({ nome: form.nome.trim(), preco: Number(form.preco), quantidade: Number(form.quantidade), estoqueMinimo: Number(form.estoqueMinimo) })
    const r = await api<{ erro?: string }>(edicao ? `/api/admin/produtos/${edicao}` : '/api/admin/produtos', { method: edicao ? 'PATCH' : 'POST', body })
    if (!r.ok) return setMsg(r.data?.erro ?? 'Não foi possível salvar o produto.')
    limpar(); setMsg('Produto salvo no estoque.'); carregar()
  }
  async function remover(item: Produto) {
    if (!confirm(`Desativar ${item.nome}? O histórico de vendas será mantido.`)) return
    const r = await api<{ erro?: string }>(`/api/admin/produtos/${item.id}`, { method: 'DELETE' })
    if (!r.ok) return setMsg(r.data?.erro ?? 'Não foi possível desativar o produto.')
    setMsg('Produto desativado.'); carregar()
  }
  return <Cartao titulo="Estoque e produtos">
    <form className="module-form" onSubmit={salvar}>
      <label>Produto<input className={campo} value={form.nome} maxLength={80} placeholder="Ex.: Pomada modeladora" onChange={(e) => mudar('nome', e.target.value)} required /></label>
      <label>Preço de venda (R$)<input className={campo} type="number" min="0.01" step="0.01" value={form.preco} onChange={(e) => mudar('preco', e.target.value)} required /></label>
      <label>Quantidade em estoque<input className={campo} type="number" min="0" step="1" value={form.quantidade} onChange={(e) => mudar('quantidade', e.target.value)} required /></label>
      <label>Alerta abaixo de<input className={campo} type="number" min="0" step="1" value={form.estoqueMinimo} onChange={(e) => mudar('estoqueMinimo', e.target.value)} required /></label>
      <div className="inline-row"><button className={botao}>{edicao ? 'Salvar produto' : 'Adicionar produto'}</button>{edicao !== null && <button type="button" className={botaoSec} onClick={limpar}>Cancelar</button>}</div>
    </form>
    {msg && <p className={msg.startsWith('Não') ? 'error' : 'success'} role="status">{msg}</p>}
    {erroCarga ? <div><p className="error" role="alert">{erroCarga}</p><button type="button" className={botaoSec} onClick={carregar}>Tentar novamente</button></div> : carregando ? <p className="muted">Carregando estoque...</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Produto</th><th>Venda</th><th>Estoque</th><th>Status</th><th></th></tr></thead><tbody>
      {itens.map((item) => <tr key={item.id}><td>{item.nome}</td><td>{brl(item.preco)}</td><td>{item.quantidade} {item.quantidade <= item.estoqueMinimo ? <span className="no-show-risk">baixo</span> : null}</td><td><span className="status-tag" data-status={item.ativo ? 'concluido' : 'cancelado'}>{item.ativo ? 'Ativo' : 'Inativo'}</span></td><td><div className="inline-row"><button className={botaoSec} onClick={() => { setEdicao(item.id); setForm({ nome: item.nome, preco: String(item.preco), quantidade: String(item.quantidade), estoqueMinimo: String(item.estoqueMinimo) }) }}>Editar</button>{item.ativo && <button className="button button-danger" onClick={() => remover(item)}>Desativar</button>}</div></td></tr>)}
      {itens.length === 0 && <tr><td colSpan={5} className="muted">Nenhum produto cadastrado.</td></tr>}
    </tbody></table></div>}
  </Cartao>
}
