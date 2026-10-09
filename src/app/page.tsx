import Link from 'next/link'
import Image from 'next/image'
import type { CSSProperties } from 'react'
import { BARBEARIA as B } from '@/config/barbearia'
import { prisma } from '@/lib/prisma'
import { BARBEARIA_PADRAO_ID } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const loja = await prisma.barbearia.findUnique({
    where: { id: BARBEARIA_PADRAO_ID },
    select: { nome: true, slogan: true, slug: true, ativa: true, imagemAmbiente: true, corPrimaria: true },
  }).catch(() => null)
  const nome = loja?.nome ?? B.nome
  const slogan = loja?.slogan ?? B.slogan
  const imagemAmbiente = loja?.imagemAmbiente || '/barbershop-ambient.png'
  const linkAgendamento = loja?.ativa ? `/agendar/${encodeURIComponent(loja.slug)}` : '/login'
  const estilo = { '--home-accent': loja?.corPrimaria ?? B.cores.primaria } as CSSProperties

  return (
    <main className="home-page" style={estilo}>
      <header className="home-nav">
        <Link href="/" className="home-brand"><span className="home-brand-mark" aria-hidden="true" />{nome}</Link>
        <div className="inline-row"><Link href="/login" className="link-muted">Entrar</Link><Link href="/cadastro" className="home-register">Cadastrar-se</Link></div>
      </header>
      <section className="home-hero">
        <Image className="home-hero-image" src={imagemAmbiente} alt="" fill priority sizes="100vw" unoptimized />
        <div className="home-hero-shade" aria-hidden="true" />
        <div className="grid justify-items-center text-center bg-black/60 backdrop-blur-md p-10 rounded-2xl border border-white/10 shadow-2xl max-w-md w-full">
          <span className="home-mark" aria-hidden="true" />
          <p className="eyebrow">BARBEARIA · GOIÂNIA</p>
          <h1 className="text-4xl font-serif text-white mb-2 !text-4xl !text-white">{nome}</h1>
          <p className="text-sm text-gray-400 mb-8">{slogan}. Escolha seu serviço, profissional e horário.</p>
          <div className="home-actions"><Link href={linkAgendamento} className="home-primary-action">Marcar horário</Link></div>
        </div>
      </section>
      <section className="home-section home-info">
        <div><span className="eyebrow">NO SEU TEMPO</span><h2>Seu próximo horário começa aqui.</h2></div>
        <p>Veja os horários disponíveis e marque seu atendimento com a equipe.</p>
        <div className="home-links"><Link href="/criar-barbearia" className="link-muted">Abrir minha barbearia online</Link><Link href="/termos" className="link-muted">Termos de uso</Link><Link href="/privacidade" className="link-muted">Privacidade</Link><span>{B.telefone}</span></div>
      </section>
    </main>
  )
}
