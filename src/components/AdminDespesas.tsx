'use client'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { botao, botaoSec, brl, campo, dataBR } from '@/components/Shell'

type Despesa = { id: number; data: string; categoria: string; descricao: string; valor: number; forma: string }
const categorias = ['Produtos e materiais', 'Aluguel e contas', 'Equipe', 'Manutenção', 'Marketing', 'Outros']
const formas = [['dinheiro', 'Dinheiro'], ['pix', 'Pix'], ['debito', 'Débito'], ['credito', 'Crédito']]

export default function AdminDespesas({ data, aoAlterar }: { data: string; aoAlterar?: () => void }) {
  const [itens, setItens] = useState<Despesa[]>([])
  const [categoria, setCategoria] = useState(categorias[0])
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState('')
  const [forma, setForma] = useState('dinheiro')
  const [msg, setMsg] = useState('')

  const carregar = useCallback(async () => {
    const r = await api<{ despesas: Despesa[] }>(`/api/admin/despesas?data=${data}`)
    if (r.ok && r.data) setItens(r.data.despesas)
  }, [data])
  useEffect(() => { carregar() }, [carregar])

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setMsg('')
    const r = await api<{ erro?: string }>('/api/admin/despesas', {
      method: 'POST', body: JSON.stringify({ data, categoria, descricao: descricao.trim(), valor: Number(valor), forma }),
    })
    if (!r.ok) return setMsg(r.data?.erro ?? 'Não foi possível lançar a despesa.')
    setDescricao(''); setValor(''); setMsg('Despesa lançada no caixa.'); carregar(); aoAlterar?.()
  }
  async function remover(item: Despesa) {
    if (!confirm(`Remover a despesa “${item.descricao}”?`)) return
    const r = await api<{ erro?: string }>(`/api/admin/despesas?id=${item.id}`, { method: 'DELETE' })
    if (!r.ok) return setMsg(r.data?.erro ?? 'Não foi possível remover a despesa.')
    setMsg('Despesa removida do caixa.'); carregar(); aoAlterar?.()
  }

  return <>
    <p className="muted">Registre os gastos do dia para ver quanto realmente ficou para a barbearia.</p>
    <form className="module-form" onSubmit={salvar}>
      <label>Categoria<select className={campo} value={categoria} onChange={(e) => setCategoria(e.target.value)}>{categorias.map((item) => <option key={item}>{item}</option>)}</select></label>
      <label>Descrição<input className={campo} value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={120} placeholder="Ex.: Pomadas e navalhas" required /></label>
      <label>Valor (R$)<input className={campo} type="number" min="0.01" max="999999" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} required /></label>
      <label>Pago com<select className={campo} value={forma} onChange={(e) => setForma(e.target.value)}>{formas.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <div className="inline-row"><button className={botao}>Lançar despesa</button></div>
    </form>
    {msg && <p className="muted" role="status">{msg}</p>}
    {itens.length === 0 ? <p className="empty-state">Nenhuma despesa lançada em {dataBR(data)}.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Categoria</th><th>Descrição</th><th>Pago com</th><th>Valor</th><th></th></tr></thead><tbody>
      {itens.map((item) => <tr key={item.id}><td>{item.categoria}</td><td>{item.descricao}</td><td>{formas.find(([value]) => value === item.forma)?.[1] ?? item.forma}</td><td>{brl(item.valor)}</td><td><button className={botaoSec} onClick={() => remover(item)}>Remover</button></td></tr>)}
    </tbody></table></div>}
  </>
}
