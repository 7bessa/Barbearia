'use client'
import { useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api-client'

export default function RedefinirSenha() {
  const [token, setToken] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  useEffect(() => {
    setToken(new URLSearchParams(window.location.search).get('token') ?? '')
    if (window.location.search) window.history.replaceState(window.history.state, '', window.location.pathname)
  }, [])
  async function salvar(e: FormEvent) {
    e.preventDefault(); setErro('')
    if (senha !== confirmacao) return setErro('As senhas não coincidem.')
    setCarregando(true)
    const r = await api<{ erro?: string }>('/api/auth/redefinir-senha', { method: 'POST', body: JSON.stringify({ token, senha }) })
    setCarregando(false)
    if (!r.ok) return setErro(r.data?.erro ?? 'Não foi possível redefinir sua senha.')
    setMensagem('Senha atualizada. Entre novamente com a nova senha.')
  }
  return <main className="auth-page"><div className="auth-layout">
    <section className="auth-brand"><div className="auth-brand-shade" /><Link href="/" className="auth-wordmark"><span className="auth-mark" aria-hidden="true" /><span>NAVALHA</span></Link><div className="auth-brand-copy"><p className="auth-kicker">ACESSO SEGURO</p><h1>Escolha uma nova senha.</h1><p>O link é temporário e será invalidado assim que você concluir a troca.</p></div><span className="brand-foot">SEGURANÇA PARA SUA EQUIPE</span></section>
    <form onSubmit={salvar} className="auth-form"><p className="auth-kicker">RECUPERAÇÃO DE ACESSO</p><h2>Nova senha</h2><p className="auth-intro">Use ao menos 8 caracteres, com letra e número.</p><label>Nova senha<input className="field" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={senha} onChange={(e) => setSenha(e.target.value)} /></label><label>Confirmar nova senha<input className="field" type="password" autoComplete="new-password" minLength={8} maxLength={72} required value={confirmacao} onChange={(e) => setConfirmacao(e.target.value)} /></label>{erro && <p className="error" role="alert">{erro}</p>}{mensagem && <p role="status">{mensagem}</p>}<button className="button button-primary" disabled={carregando || !token || !!mensagem}>{carregando ? 'Atualizando...' : 'Salvar nova senha'}</button><p className="muted"><Link href="/login" className="text-link">Voltar ao acesso</Link></p></form>
  </div></main>
}
