'use client'
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { api } from '@/lib/api-client'
import { botao, botaoSec, brl, campo } from '@/components/Shell'

type Valores = { dinheiro: number; pix: number; debito: number; credito: number }
type Fechamento = { abertura: number; esperado: Valores; despesasPorForma: Valores; fechado: boolean; contado: Valores | null; diferenca: number | null; observacao: string; fechadoEm: string | null }
const formas: [keyof Valores, string][] = [['dinheiro', 'Dinheiro'], ['pix', 'Pix'], ['debito', 'Débito'], ['credito', 'Crédito']]
const vazio: Valores = { dinheiro: 0, pix: 0, debito: 0, credito: 0 }

export default function AdminFechamentoCaixa({ data, atualizacao, aoAlterar }: { data: string; atualizacao: number; aoAlterar?: () => void }) {
  const [resumo, setResumo] = useState<Fechamento | null>(null)
  const [abertura, setAbertura] = useState('0')
  const [contado, setContado] = useState<Valores>(vazio)
  const [observacao, setObservacao] = useState('')
  const [msg, setMsg] = useState('')
  const carregar = useCallback(async () => {
    const r = await api<Fechamento>(`/api/admin/financeiro/fechamento?data=${data}`)
    if (r.ok && r.data) {
      setResumo(r.data); setAbertura(String(r.data.abertura)); setContado(r.data.contado ?? r.data.esperado); setObservacao(r.data.observacao)
    }
  }, [data])
  useEffect(() => { carregar() }, [carregar, atualizacao])
  const mudarContado = (forma: keyof Valores, valor: string) => setContado((anterior) => ({ ...anterior, [forma]: Number(valor) }))
  async function abrir(e: FormEvent) {
    e.preventDefault(); setMsg('')
    const r = await api<{ erro?: string }>('/api/admin/financeiro/fechamento', { method: 'POST', body: JSON.stringify({ acao: 'abrir', data, abertura: Number(abertura) }) })
    if (!r.ok) return setMsg(r.data?.erro ?? 'Não foi possível abrir o caixa.')
    setMsg('Abertura de caixa registrada.'); carregar(); aoAlterar?.()
  }
  async function fechar(e: FormEvent) {
    e.preventDefault(); setMsg('')
    const r = await api<{ erro?: string }>('/api/admin/financeiro/fechamento', { method: 'POST', body: JSON.stringify({ acao: 'fechar', data, contado, observacao }) })
    if (!r.ok) return setMsg(r.data?.erro ?? 'Não foi possível fechar o caixa.')
    setMsg('Caixa fechado e conferência salva.'); carregar(); aoAlterar?.()
  }
  if (!resumo) return <p className="muted">Carregando conferência do caixa...</p>
  return <>
    <p className="muted">Confira o valor esperado em cada forma de pagamento antes de encerrar o dia.</p>
    {!resumo.fechado && <form className="inline-row" onSubmit={abrir}><label>Abertura em dinheiro (R$)<input className={campo} type="number" min="0" step="0.01" value={abertura} onChange={(e) => setAbertura(e.target.value)} /></label><button className={botaoSec}>Salvar abertura</button></form>}
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Forma</th><th>Vendas</th><th>Despesas</th><th>Esperado</th><th>Contado</th></tr></thead><tbody>
      {formas.map(([forma, nome]) => <tr key={forma}><td>{nome}</td><td>{brl((resumo.esperado[forma] + resumo.despesasPorForma[forma] - (forma === 'dinheiro' ? resumo.abertura : 0)))}</td><td>{brl(resumo.despesasPorForma[forma])}</td><td>{brl(resumo.esperado[forma])}</td><td>{resumo.fechado ? brl(resumo.contado?.[forma] ?? 0) : <input className={campo} aria-label={`Valor contado em ${nome}`} type="number" min="0" step="0.01" value={contado[forma]} onChange={(e) => mudarContado(forma, e.target.value)} />}</td></tr>)}
    </tbody></table></div>
    {resumo.fechado ? <><p className={resumo.diferenca === 0 ? 'success' : 'error'}>{resumo.diferenca === 0 ? 'Caixa conferido sem diferença.' : `Diferença no fechamento: ${brl(resumo.diferenca ?? 0)}.`}</p>{resumo.observacao && <p className="muted">Observação: {resumo.observacao}</p>}</> : <form className="module-form" onSubmit={fechar}><label>Observação do fechamento<input className={campo} value={observacao} onChange={(e) => setObservacao(e.target.value)} maxLength={300} placeholder="Ex.: diferença explicada por troco" /></label><div className="inline-row"><button className={botao}>Fechar caixa do dia</button></div></form>}
    {msg && <p className={msg.startsWith('Não') ? 'error' : 'success'} role="status">{msg}</p>}
  </>
}
