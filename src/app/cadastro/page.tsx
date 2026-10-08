'use client'
import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/store/auth'
import { BARBEARIA } from '@/config/barbearia'

const campo = 'field'

export default function Cadastro() {
  const router = useRouter()
  const cadastrar = useAuth((s) => s.cadastrar)
  const [perfil, setPerfil] = useState<'cliente' | 'barbeiro'>('cliente')
  const [f, setF] = useState({ nome: '', telefone: '', email: '', senha: '', codigoConvite: '' })
  const [aceito, setAceito] = useState(false)
  const [erro, setErro] = useState('')
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!aceito) return setErro('É preciso aceitar os termos e a política de privacidade.')
    const msg = await cadastrar({ ...f, aceitoTermos: true, role: perfil, codigoConvite: perfil === 'barbeiro' ? f.codigoConvite : undefined })
    if (msg) return setErro(msg)
    const u = useAuth.getState().usuario!
    router.replace(u.role === 'barbeiro' ? '/barbeiro/agenda' : '/cliente/agendar')
    router.refresh()
  }

  return (
    <main className="auth-page">
      <div className="auth-layout">
        <section className="auth-brand">
          <Link href="/" aria-label="Voltar ao início"><Image src={BARBEARIA.logo} alt="" width={42} height={42} /></Link>
          <div><h1>{BARBEARIA.nome}</h1><p>{BARBEARIA.slogan}</p></div>
          <span className="brand-foot">SEU ESTILO, NO SEU TEMPO</span>
        </section>
        <form onSubmit={enviar} className="auth-form">
          <h2>Criar conta</h2>
          <div className="segmented" role="group" aria-label="Tipo de conta">
            {(['cliente', 'barbeiro'] as const).map((p) => <button type="button" key={p} aria-pressed={perfil === p} onClick={() => setPerfil(p)}>{p === 'cliente' ? 'Cliente' : 'Barbeiro'}</button>)}
          </div>
          <label>Nome completo<input className={campo} placeholder="Seu nome" value={f.nome} onChange={set('nome')} required /></label>
          <label>Telefone<input className={campo} placeholder="Com DDD" inputMode="tel" value={f.telefone} onChange={set('telefone')} required /></label>
          <label>E-mail<input className={campo} type="email" placeholder="voce@exemplo.com" value={f.email} onChange={set('email')} required /></label>
          <label>Senha<input className={campo} type="password" placeholder="Mínimo 8 caracteres, com letra e número" value={f.senha} onChange={set('senha')} required /></label>
          {perfil === 'barbeiro' && <label>Código de convite<input className={campo} placeholder="Código fornecido pelo responsável" value={f.codigoConvite} onChange={set('codigoConvite')} required /></label>}
          <label className="check-label"><input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} /><span>Aceito os <Link href="/termos" target="_blank" className="text-link">termos de uso</Link> e a <Link href="/privacidade" target="_blank" className="text-link">política de privacidade</Link>.</span></label>
          {erro && <p className="error" role="alert">{erro}</p>}
          <button className="button button-primary">Criar conta</button>
          <p className="muted">Já tem conta? <Link href="/login" className="text-link">Entrar</Link></p>
        </form>
      </div>
    </main>
  )
}
