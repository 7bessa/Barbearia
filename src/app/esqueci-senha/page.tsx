'use client'
import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api-client'

export default function EsqueciSenha() {
  const [email, setEmail] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [linkLocal, setLinkLocal] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  async function enviar(e: FormEvent) {
    e.preventDefault(); setErro(''); setCarregando(true)
    const r = await api<{ mensagem?: string; erro?: string; linkLocal?: string }>('/api/auth/esqueci-senha', { method: 'POST', body: JSON.stringify({ email }) })
    setCarregando(false)
    if (!r.ok) return setErro(r.data?.erro ?? 'Não foi possível solicitar a recuperação.')
    setMensagem(r.data?.mensagem ?? 'Se o e-mail estiver cadastrado, enviaremos instruções.')
    if (r.data?.linkLocal) setLinkLocal(r.data.linkLocal)
  }
  return <main className="auth-page"><div className="auth-layout">
    <section className="auth-brand"><div className="auth-brand-shade" /><Link href="/" className="auth-wordmark"><span className="auth-mark" aria-hidden="true" /><span>NAVALHA</span></Link><div className="auth-brand-copy"><p className="auth-kicker">ACESSO SEGURO</p><h1>Retome sua rotina.</h1><p>Vamos ajudar você a recuperar o acesso à sua conta.</p></div><span className="brand-foot">SUA BARBEARIA EM BOAS MÃOS</span></section>
    <form onSubmit={enviar} className="auth-form"><p className="auth-kicker">RECUPERAÇÃO DE ACESSO</p><h2>Redefinir senha</h2><p className="auth-intro">Enviaremos um link para o e-mail da sua conta.</p><label>E-mail<input className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>{erro && <p className="error" role="alert">{erro}</p>}{mensagem && <p role="status">{mensagem}</p>}{linkLocal && <p className="muted">Ambiente local: <a className="text-link" href={linkLocal}>abrir link para redefinir senha</a></p>}<button className="button button-primary" disabled={carregando}>{carregando ? 'Enviando...' : 'Enviar instruções'}</button><p className="muted"><Link href="/login" className="text-link">Voltar ao acesso</Link></p></form>
  </div></main>
}
