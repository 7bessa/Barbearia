'use client'
import { useState, type CSSProperties, type FormEvent } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
import { BARBEARIA } from '@/config/barbearia'
import { normalizarSlug } from '@/lib/slug-barbearia'

type Dados = {
  nomeBarbearia: string
  slogan: string
  slug: string
  corPrimaria: string
  corFundo: string
  nome: string
  telefone: string
  email: string
  senha: string
  confirmarSenha: string
}

export default function CriarBarbearia() {
  const router = useRouter()
  const [dados, setDados] = useState<Dados>({
    nomeBarbearia: '', slogan: '', slug: '', corPrimaria: '#fbbf24', corFundo: '#09090b',
    nome: '', telefone: '', email: '', senha: '', confirmarSenha: '',
  })
  const [slugManual, setSlugManual] = useState(false)
  const [aceito, setAceito] = useState(false)
  const [erro, setErro] = useState('')
  const [salvando, setSalvando] = useState(false)

  function mudar(chave: keyof Dados, valor: string) {
    setDados((atual) => ({ ...atual, [chave]: valor }))
  }

  function mudarNomeBarbearia(valor: string) {
    setDados((atual) => ({
      ...atual,
      nomeBarbearia: valor,
      slug: slugManual ? atual.slug : normalizarSlug(valor),
    }))
  }

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    if (dados.senha !== dados.confirmarSenha) return setErro('As senhas não coincidem.')
    if (!aceito) return setErro('É preciso aceitar os termos e a política de privacidade.')

    setSalvando(true)
    const r = await api<{ erro?: string }>('/api/onboarding', {
      method: 'POST',
      body: JSON.stringify({
        nomeBarbearia: dados.nomeBarbearia,
        slogan: dados.slogan,
        slug: dados.slug,
        corPrimaria: dados.corPrimaria,
        corFundo: dados.corFundo,
        nome: dados.nome,
        telefone: dados.telefone,
        email: dados.email,
        senha: dados.senha,
        aceitoTermos: true,
      }),
    })
    setSalvando(false)
    if (!r.ok) return setErro(r.data?.erro ?? 'Não foi possível criar a barbearia.')

    router.replace('/admin/dashboard')
    router.refresh()
  }

  const estilo = { '--brand-preview-bg': dados.corFundo, '--brand-preview-accent': dados.corPrimaria } as CSSProperties

  return <main className="auth-page">
    <div className="auth-layout">
      <section className="auth-brand">
        <Link href="/" aria-label="Voltar ao início"><Image src={BARBEARIA.logo} alt="" width={42} height={42} /></Link>
        <div><h1>Nova barbearia</h1><p>Crie sua página de agendamento e acesso de administrador.</p></div>
        <span className="brand-foot">SUA MARCA, SEU ENDEREÇO</span>
      </section>
      <form onSubmit={enviar} className="auth-form">
        <h2>Dados da barbearia</h2>
        <label>Nome da barbearia<input className="field" value={dados.nomeBarbearia} onChange={(e) => mudarNomeBarbearia(e.target.value)} maxLength={70} autoComplete="organization" required /></label>
        <label>Frase curta<input className="field" value={dados.slogan} onChange={(e) => mudar('slogan', e.target.value)} maxLength={100} /></label>
        <label>Endereço público<input className="field" value={dados.slug} onChange={(e) => { setSlugManual(true); mudar('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-{2,}/g, '-')) }} maxLength={48} autoCapitalize="none" autoCorrect="off" required /></label>
        <p className="muted">Link: /agendar/{dados.slug || 'seu-endereco'}</p>
        <div className="module-form">
          <label className="brand-color-field">Cor principal<input type="color" value={dados.corPrimaria} onChange={(e) => mudar('corPrimaria', e.target.value)} /></label>
          <label className="brand-color-field">Cor de fundo<input type="color" value={dados.corFundo} onChange={(e) => mudar('corFundo', e.target.value)} /></label>
        </div>
        <div className="brand-preview" style={estilo}><span>AGENDAMENTO ONLINE</span><strong>{dados.nomeBarbearia || 'Sua barbearia'}</strong><small>{dados.slogan || 'Escolha serviço e horário.'}</small></div>

        <h2>Responsável</h2>
        <label>Nome completo<input className="field" value={dados.nome} onChange={(e) => mudar('nome', e.target.value)} autoComplete="name" maxLength={80} required /></label>
        <label>Telefone<input className="field" type="tel" inputMode="tel" autoComplete="tel" placeholder="Com DDD" value={dados.telefone} onChange={(e) => mudar('telefone', e.target.value)} maxLength={30} required /></label>
        <label>E-mail<input className="field" type="email" autoComplete="email" value={dados.email} onChange={(e) => mudar('email', e.target.value)} maxLength={254} required /></label>
        <label>Senha<input className="field" type="password" autoComplete="new-password" value={dados.senha} onChange={(e) => mudar('senha', e.target.value)} minLength={8} maxLength={72} required /></label>
        <label>Confirmar senha<input className="field" type="password" autoComplete="new-password" value={dados.confirmarSenha} onChange={(e) => mudar('confirmarSenha', e.target.value)} minLength={8} maxLength={72} required /></label>
        <label className="check-label"><input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} /><span>Aceito os <Link href="/termos" target="_blank" className="text-link">termos de uso</Link> e a <Link href="/privacidade" target="_blank" className="text-link">política de privacidade</Link>.</span></label>
        {erro && <p className="error" role="alert">{erro}</p>}
        <button disabled={salvando} className="button button-primary">{salvando ? 'Criando...' : 'Criar barbearia'}</button>
        <p className="muted">Já tem acesso? <Link href="/login" className="text-link">Entrar</Link></p>
      </form>
    </div>
  </main>
}
