'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/store/auth'

const HOME = { cliente: '/cliente/agendar', barbeiro: '/barbeiro/agenda', recepcionista: '/recepcao/dashboard', admin: '/admin/dashboard' } as const

export default function Login() {
  const router = useRouter()
  const login = useAuth((s) => s.login)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setErro(''); setCarregando(true)
    const msg = await login(email, senha)
    setCarregando(false)
    if (msg) return setErro(msg)
    const u = useAuth.getState().usuario!
    router.replace(HOME[u.role])
    router.refresh()
  }

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <section className="auth-brand">
          <div className="auth-brand-shade" />
          <Link href="/" aria-label="Voltar ao início" className="auth-wordmark"><span className="auth-mark" aria-hidden="true" /><span>NAVALHA</span></Link>
          <div className="auth-brand-copy"><p className="auth-kicker">GESTÃO PARA BARBEARIAS</p><h1>Presença em cada detalhe.</h1><p>Uma rotina mais organizada para a sua cadeira, sua equipe e seus clientes.</p></div>
          <span className="brand-foot">TRADIÇÃO QUE MOVE O SEU DIA</span>
        </section>
        <form onSubmit={entrar} className="auth-form">
          <p className="auth-kicker">BEM-VINDO DE VOLTA</p>
          <h2>Entrar na sua conta</h2>
          <p className="auth-intro">Acesse a operação da sua barbearia.</p>
          <label>E-mail<span className="auth-field"><span className="field-icon field-icon-mail" aria-hidden="true" /><input className="field" type="email" placeholder="voce@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></span></label>
          <label>Senha<span className="auth-field"><span className="field-icon field-icon-lock" aria-hidden="true" /><input className="field" type="password" placeholder="Sua senha" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required /></span></label>
          {erro && <p className="error" role="alert">{erro}</p>}
          <button disabled={carregando} className="button button-primary">{carregando ? 'Entrando...' : 'Entrar'}</button>
          <p className="muted">Ainda não tem conta? <Link href="/cadastro" className="text-link">Cadastrar-se</Link></p>
          <p className="muted">Tem uma barbearia? <Link href="/criar-barbearia" className="text-link">Abrir acesso do responsável</Link></p>
          <Link href="/" className="link-muted">Voltar ao início</Link>
        </form>
      </div>
    </main>
  )
}
