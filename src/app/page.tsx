import Link from 'next/link'
import Image from 'next/image'
import { BARBEARIA as B } from '@/config/barbearia'
import { prisma } from '@/lib/prisma'
import { BARBEARIA_PADRAO_ID } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const loja = await prisma.barbearia.findUnique({
    where: { id: BARBEARIA_PADRAO_ID },
    select: { nome: true, slogan: true, slug: true, ativa: true, imagemAmbiente: true },
  }).catch(() => null)
  const nome = loja?.nome ?? B.nome
  const slogan = loja?.slogan ?? B.slogan
  const imagemAmbiente = loja?.imagemAmbiente || '/barbershop-ambient.png'
  const linkAgendamento = loja?.ativa ? `/agendar/${encodeURIComponent(loja.slug)}` : '/login'

  return (
    <main className="home-page">
      <header className="home-nav">
        <Link href="/" className="home-brand"><Image src={B.logo} alt="" width={32} height={32} />{nome}</Link>
        <div className="inline-row"><Link href="/login" className="link-muted">Entrar</Link><Link href="/cadastro" className="button button-primary">Cadastrar-se</Link></div>
      </header>
      <section className="home-hero">
        <img className="home-hero-image" src={imagemAmbiente} alt="" />
        <div className="home-hero-shade" aria-hidden="true" />
        <div className="home-hero-content">
          <Image className="home-mark" src={B.logo} alt="" width={76} height={76} priority />
          <p className="eyebrow">BARBEARIA · GOIÂNIA</p>
          <h1>{nome}</h1>
          <p>{slogan}. Escolha seu serviço, profissional e horário.</p>
          <div className="home-actions"><Link href={linkAgendamento} className="button button-primary">Marcar horário</Link><Link href="/cadastro" className="button button-secondary">Cadastrar-se</Link></div>
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
