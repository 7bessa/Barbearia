'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/store/auth'

const campo = 'field'

export default function Cadastro() {
  const router = useRouter()
  const cadastrar = useAuth((s) => s.cadastrar)
  const [perfil, setPerfil] = useState<'cliente' | 'barbeiro' | 'recepcionista'>('cliente')
  const [f, setF] = useState({ nome: '', telefone: '', email: '', senha: '', codigoConvite: '' })
  const [aceito, setAceito] = useState(false)
  const [erro, setErro] = useState('')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!aceito) return setErro('É preciso aceitar os termos e a política de privacidade.')
    const resultado = await cadastrar({ ...f, aceitoTermos: true, role: perfil, codigoConvite: perfil === 'cliente' ? undefined : f.codigoConvite })
    if (resultado.erro) return setErro(resultado.erro)
    const query = new URLSearchParams({ email: resultado.email ?? '' })
    if (resultado.linkLocal) query.set('link', resultado.linkLocal)
    router.replace(`/verificar-email?${query}`)
  }

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <section className="auth-brand">
          <div className="auth-brand-shade" />
          <Link href="/" aria-label="Voltar ao início" className="auth-wordmark"><span className="auth-mark" aria-hidden="true" /><span>NAVALHA</span></Link>
          <div className="auth-brand-copy"><p className="auth-kicker">AGENDE DO SEU JEITO</p><h1>Seu tempo merece cuidado.</h1><p>Encontre seu profissional, escolha o serviço e confirme seu horário.</p></div>
          <span className="brand-foot">ESTILO COM HORA MARCADA</span>
        </section>
        <form onSubmit={enviar} className="auth-form">
          <p className="auth-kicker">PRIMEIRO ACESSO</p>
          <h2>Crie sua conta</h2>
          <p className="auth-intro">Deixe seu próximo atendimento mais simples.</p>
          <div className="segmented" role="group" aria-label="Tipo de conta">
            {(['cliente', 'barbeiro', 'recepcionista'] as const).map((p) => <button type="button" key={p} aria-pressed={perfil === p} onClick={() => setPerfil(p)}>{p === 'recepcionista' ? 'Atendente' : p === 'cliente' ? 'Cliente' : 'Barbeiro'}</button>)}
          </div>
          <label>Nome completo<input className={campo} placeholder="Seu nome" value={f.nome} onChange={set('nome')} required /></label>
          <label>Telefone<input className={campo} placeholder="Com DDD" inputMode="tel" value={f.telefone} onChange={set('telefone')} required /></label>
          <label>E-mail<span className="auth-field"><span className="field-icon field-icon-mail" aria-hidden="true" /><input className={campo} type="email" placeholder="voce@exemplo.com" value={f.email} onChange={set('email')} required /></span></label>
          <label>Senha<span className="auth-field"><span className="field-icon field-icon-lock" aria-hidden="true" /><input className={campo} type="password" placeholder="Mínimo 8 caracteres, com letra e número" value={f.senha} onChange={set('senha')} required /></span></label>
          {perfil !== 'cliente' && <label>Código de convite<input className={campo} placeholder="Código fornecido pelo responsável" value={f.codigoConvite} onChange={set('codigoConvite')} required /></label>}
          <label className="check-label"><input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} /><span>Aceito os <Link href="/termos" target="_blank" className="text-link">termos de uso</Link> e a <Link href="/privacidade" target="_blank" className="text-link">política de privacidade</Link>.</span></label>
          {erro && <p className="error" role="alert">{erro}</p>}
          <button className="button button-primary">Cadastrar minha conta</button>
          <p className="muted">Já tem conta? <Link href="/login" className="text-link">Entrar</Link></p>
        </form>
      </div>
    </main>
  )
}
