'use client'
import { useState, type CSSProperties, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api-client'
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
    nomeBarbearia: '', slogan: '', slug: '', corPrimaria: '#c28a45', corFundo: '#100c0a',
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
    if (dados.senha.length < 8 || !/[A-Za-z]/.test(dados.senha) || !/\d/.test(dados.senha)) {
      return setErro('Use uma senha com pelo menos 8 caracteres, incluindo letra e número.')
    }
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
    if (!r.ok) return setErro(r.data?.erro ?? 'Não foi possível abrir a barbearia online.')

    router.replace('/admin/dashboard')
    router.refresh()
  }

  const estilo = { '--brand-preview-bg': dados.corFundo, '--brand-preview-accent': dados.corPrimaria } as CSSProperties

  return <main className="auth-page">
    <div className="auth-layout">
      <section className="auth-brand">
        <div className="auth-brand-shade" />
        <Link href="/" aria-label="Voltar ao início" className="auth-wordmark"><span className="auth-mark" aria-hidden="true" /><span>NAVALHA</span></Link>
        <div className="auth-brand-copy"><p className="auth-kicker">COMECE COM IDENTIDADE</p><h1>A sua barbearia no controle.</h1><p>Publique seu link de agendamento e organize o dia a dia em um só lugar.</p></div>
        <span className="brand-foot">SUA MARCA, SEU ENDEREÇO</span>
      </section>
      <form onSubmit={enviar} className="auth-form">
        <p className="auth-kicker">PRIMEIRO PASSO</p>
        <h2>Dados da barbearia</h2>
        <p className="auth-intro">Defina a presença que seus clientes vão encontrar.</p>
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
        <label>Senha<input className="field" type="password" autoComplete="new-password" value={dados.senha} onChange={(e) => mudar('senha', e.target.value)} minLength={8} maxLength={72} required aria-describedby="senha-ajuda" /></label>
        <p id="senha-ajuda" className="muted">Use ao menos 8 caracteres, com letra e número.</p>
        <label>Confirmar senha<input className="field" type="password" autoComplete="new-password" value={dados.confirmarSenha} onChange={(e) => mudar('confirmarSenha', e.target.value)} minLength={8} maxLength={72} required /></label>
        <label className="check-label"><input type="checkbox" checked={aceito} onChange={(e) => setAceito(e.target.checked)} /><span>Aceito os <Link href="/termos" target="_blank" className="text-link">termos de uso</Link> e a <Link href="/privacidade" target="_blank" className="text-link">política de privacidade</Link>.</span></label>
        {erro && <p className="error" role="alert">{erro}</p>}
        <button disabled={salvando} className="button button-primary">{salvando ? 'Preparando sua barbearia...' : 'Abrir minha barbearia online'}</button>
        <p className="muted">Já tem acesso? <Link href="/login" className="text-link">Entrar</Link></p>
      </form>
    </div>
  </main>
}
