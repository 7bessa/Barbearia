'use client'
import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api-client'

export default function VerificarEmail() {
  const [token, setToken] = useState('')
  const [linkLocal, setLinkLocal] = useState('')
  const [email, setEmail] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setToken(params.get('token') ?? '')
    setEmail(params.get('email') ?? '')
    setLinkLocal(params.get('link') ?? '')
    if (window.location.search) window.history.replaceState(window.history.state, '', window.location.pathname)
  }, [])

  async function confirmar() {
    setErro(''); setCarregando(true)
    const r = await api<{ erro?: string }>('/api/auth/verificar-email', { method: 'POST', body: JSON.stringify({ token }) })
    setCarregando(false)
    if (!r.ok) return setErro(r.data?.erro ?? 'Não foi possível confirmar o e-mail.')
    setMensagem('E-mail confirmado. Você já pode entrar na sua conta.')
  }

  async function reenviar(e: FormEvent) {
    e.preventDefault(); setErro(''); setCarregando(true)
    const r = await api<{ mensagem?: string; erro?: string; linkLocal?: string }>('/api/auth/reenviar-verificacao', { method: 'POST', body: JSON.stringify({ email }) })
    setCarregando(false)
    if (!r.ok) return setErro(r.data?.erro ?? 'Não foi possível solicitar outro link.')
    setMensagem(r.data?.mensagem ?? 'Se houver uma conta pendente, enviaremos um novo link.')
    if (r.data?.linkLocal) setLinkLocal(r.data.linkLocal)
  }

  return <main className="auth-page"><div className="auth-layout">
    <section className="auth-brand"><div className="auth-brand-shade" /><Link href="/" className="auth-wordmark"><span className="auth-mark" aria-hidden="true" /><span>NAVALHA</span></Link><div className="auth-brand-copy"><p className="auth-kicker">SEGURANÇA DA CONTA</p><h1>Um último passo.</h1><p>Confirme seu endereço de e-mail para proteger o acesso à sua conta.</p></div><span className="brand-foot">CUIDADO EM CADA DETALHE</span></section>
    <section className="auth-form"><p className="auth-kicker">CONFIRMAÇÃO DE E-MAIL</p><h2>Confirme seu endereço</h2>
      {token ? <><p className="auth-intro">O link é válido por 24 horas e só pode ser usado uma vez.</p><button className="button button-primary" onClick={confirmar} disabled={carregando || !!mensagem}>{carregando ? 'Confirmando...' : 'Confirmar meu e-mail'}</button></> : <form onSubmit={reenviar}><p className="auth-intro">Informe o e-mail usado no cadastro para receber outro link.</p><label>E-mail<input className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label><button className="button button-primary" disabled={carregando}>{carregando ? 'Enviando...' : 'Reenviar confirmação'}</button></form>}
      {mensagem && <p role="status">{mensagem}</p>}{erro && <p className="error" role="alert">{erro}</p>}{linkLocal && <p className="muted">Ambiente local: <a className="text-link" href={linkLocal}>abrir link de confirmação</a></p>}
      <p className="muted"><Link href="/login" className="text-link">Voltar ao acesso</Link></p>
    </section>
  </div></main>
}
