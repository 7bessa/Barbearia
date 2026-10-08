'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/store/auth'
import { BARBEARIA } from '@/config/barbearia'

const HOME = { cliente: '/cliente/agendar', barbeiro: '/barbeiro/agenda', admin: '/admin/dashboard' } as const

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
          <Link href="/" aria-label="Voltar ao início"><Image src={BARBEARIA.logo} alt="" width={42} height={42} /></Link>
          <div><h1>{BARBEARIA.nome}</h1><p>{BARBEARIA.slogan}</p></div>
          <span className="brand-foot">AGENDE SEU PRÓXIMO HORÁRIO</span>
        </section>
        <form onSubmit={entrar} className="auth-form">
          <h2>Entrar na sua conta</h2>
          <label>E-mail<input className="field" type="email" placeholder="voce@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required /></label>
          <label>Senha<input className="field" type="password" placeholder="Sua senha" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" required /></label>
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
