'use client'

import { useEffect, useState } from 'react'
import Shell, { Cartao, botao } from '@/components/Shell'
import { api } from '@/lib/api-client'

type Plano = { plano: string; nome: string; configurado: boolean; valor?: number; moeda?: string; frequencia?: number; frequenciaTipo?: string; reason?: string; limites: { profissionais: number; cadeiras: number } }
type Dados = {
  erro?: string
  barbearia: { nome: string; plano: string; assinaturaStatus: string; testeAte: string | null }
  planos: Plano[]
  assinatura: { plano: string; status: string; checkoutUrl: string | null; criadaEm: string } | null
  ultimaFatura: { status?: string; detalhe?: string; tentativa?: number; recebidaEm: string } | null
  testeAtivo: boolean
  configuracaoPronta: boolean
}

function valorPlano(plano: Plano) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: plano.moeda ?? 'BRL' }).format(plano.valor ?? 0)
}

function ciclo(plano: Plano) {
  if (!plano.frequencia || !plano.frequenciaTipo) return 'Cobrança recorrente'
  const tipo = plano.frequenciaTipo.toLowerCase().includes('month') ? (plano.frequencia === 1 ? 'mês' : 'meses') : (plano.frequencia === 1 ? 'dia' : 'dias')
  return `a cada ${plano.frequencia} ${tipo}`
}

function limite(valor: number) { return valor >= 999 ? 'ilimitados' : String(valor) }

export default function AssinaturaPage() {
  const [dados, setDados] = useState<Dados | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState('')
  const [cancelando, setCancelando] = useState(false)
  const [retorno, setRetorno] = useState(false)

  useEffect(() => {
    setRetorno(new URLSearchParams(window.location.search).get('retorno') === 'mercadopago')
    api<Dados>('/api/admin/assinatura').then((r) => {
      if (r.ok && r.data) setDados(r.data)
      else setErro(r.status === 403 ? 'Somente o responsável pela barbearia pode acessar a cobrança.' : r.data?.erro ?? 'Não foi possível carregar o plano.')
      setCarregando(false)
    })
  }, [])

  async function contratar(plano: string) {
    setErro('')
    setEnviando(plano)
    const r = await api<{ checkoutUrl?: string; erro?: string }>('/api/admin/assinatura', { method: 'POST', body: JSON.stringify({ plano }) })
    if (r.ok && r.data?.checkoutUrl) window.location.assign(r.data.checkoutUrl)
    else setErro(r.data?.erro ?? 'Não foi possível abrir o pagamento.')
    setEnviando('')
  }

  async function cancelar() {
    if (!window.confirm('Cancelar a renovação? Quando o Mercado Pago confirmar, o acesso será encerrado, exceto se o período de teste ainda estiver ativo.')) return
    setErro('')
    setCancelando(true)
    const r = await api<{ erro?: string }>('/api/admin/assinatura/cancelar', { method: 'POST', body: '{}' })
    if (r.ok) {
      const atualizado = await api<Dados>('/api/admin/assinatura')
      if (atualizado.ok && atualizado.data) setDados(atualizado.data)
    } else setErro(r.data?.erro ?? 'Não foi possível cancelar a assinatura.')
    setCancelando(false)
  }

  return (
    <Shell titulo="Plano e cobrança" mainClassName="">
      {carregando && <p className="muted">Carregando informações do plano...</p>}
      {!carregando && erro && !dados && <p role="alert" className="text-sm text-red-400">{erro}</p>}
      {dados && (
        <div className="space-y-5">
          <Cartao titulo="Situação da assinatura">
            <div className="list-row">
              <div className="list-main">
                <p className="list-title">{dados.barbearia.nome} · Plano {dados.barbearia.plano === 'profissional' ? 'Profissional' : 'Essencial'}</p>
                <p className="list-meta">
                  {dados.testeAtivo && dados.barbearia.testeAte
                    ? `Período de teste até ${new Date(dados.barbearia.testeAte).toLocaleDateString('pt-BR')}`
                    : dados.barbearia.assinaturaStatus === 'teste' ? 'Período de teste encerrado'
                    : dados.barbearia.assinaturaStatus === 'ativa' ? 'Assinatura ativa' : `Acesso ${dados.barbearia.assinaturaStatus}`}
                </p>
              </div>
              <span className="status-tag" data-status={dados.testeAtivo || dados.barbearia.assinaturaStatus === 'ativa' ? 'concluido' : 'faltou'}>
                {dados.testeAtivo ? 'Teste' : dados.barbearia.assinaturaStatus === 'teste' ? 'Expirado' : dados.barbearia.assinaturaStatus}
              </span>
            </div>
            {retorno && <p className="mt-4 text-sm text-gray-300">Retorno recebido. A confirmação do pagamento pode levar alguns instantes.</p>}
            {dados.ultimaFatura && (
              <p className={`mt-3 text-sm ${dados.ultimaFatura.status === 'approved' ? 'text-emerald-400' : 'text-amber-300'}`}>
                Última cobrança recorrente: {dados.ultimaFatura.status === 'approved' ? 'aprovada' : dados.ultimaFatura.status ?? 'em processamento'}
                {dados.ultimaFatura.detalhe ? ` · ${dados.ultimaFatura.detalhe}` : ''}
                {dados.ultimaFatura.tentativa ? ` · tentativa ${dados.ultimaFatura.tentativa}` : ''}
                {' · '}{new Date(dados.ultimaFatura.recebidaEm).toLocaleString('pt-BR')}
              </p>
            )}
            {dados.assinatura?.status === 'authorized' && <p className="mt-3 text-sm text-gray-400">Para trocar de plano, cancele a renovação atual e contrate o novo plano.</p>}
            {dados.assinatura?.status === 'pending' && dados.assinatura.checkoutUrl && (
              <a className={`${botao} mt-4 inline-flex no-underline`} href={dados.assinatura.checkoutUrl}>Continuar pagamento</a>
            )}
            {(dados.assinatura?.status === 'authorized' || dados.assinatura?.status === 'pending') && (
              <div className="mt-4">
                <button type="button" className="button button-secondary" disabled={cancelando} onClick={cancelar}>
                  {cancelando ? 'Cancelando...' : 'Cancelar renovação'}
                </button>
                <p className="mt-2 max-w-xl text-xs text-gray-500">O acesso será encerrado após a confirmação do Mercado Pago, exceto durante um período de teste ainda ativo.</p>
              </div>
            )}
          </Cartao>

          <section aria-labelledby="planos-heading">
            <div className="mb-3 flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">PLANOS DA BARBEARIA</p>
                <h2 id="planos-heading" className="text-xl font-semibold text-white">Escolha como quer atender</h2>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {dados.planos.map((plano) => (
                <Cartao key={plano.plano} titulo={plano.nome}>
                  {plano.configurado ? (
                    <>
                      <p className="text-2xl font-bold text-barber-gold">{valorPlano(plano)}<span className="ml-2 text-sm font-normal text-gray-400">{ciclo(plano)}</span></p>
                      <p className="mt-3 text-sm text-gray-300">Até {limite(plano.limites.profissionais)} profissionais e {limite(plano.limites.cadeiras)} cadeiras.</p>
                      <p className="mt-1 text-xs text-gray-500">Cobrança processada pelo Mercado Pago.</p>
                      <button type="button" className={`${botao} mt-5`} disabled={!dados.configuracaoPronta || enviando !== '' || dados.assinatura?.status === 'authorized'} onClick={() => contratar(plano.plano)}>
                        {enviando === plano.plano ? 'Abrindo pagamento...' : dados.assinatura?.status === 'authorized' && dados.barbearia.plano === plano.plano ? 'Plano atual' : 'Assinar este plano'}
                      </button>
                    </>
                  ) : <p className="text-sm text-gray-400">Este plano ainda não está disponível.</p>}
                </Cartao>
              ))}
            </div>
          </section>
          {!dados.configuracaoPronta && <p className="text-sm text-gray-500">A contratação online ainda está sendo preparada.</p>}
          {erro && dados && <p role="alert" className="text-sm text-red-400">{erro}</p>}
        </div>
      )}
    </Shell>
  )
}
