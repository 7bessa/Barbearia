import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import '@fontsource/playfair-display/latin-600.css'
import '@fontsource/playfair-display/latin-700.css'
import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { BARBEARIA } from '@/config/barbearia'
import { prisma } from '@/lib/prisma'
import { BARBEARIA_PADRAO_ID } from '@/lib/db'

export const dynamic = 'force-dynamic' // necessário para o CSP com nonce em produção

export async function generateMetadata(): Promise<Metadata> {
  const loja = await prisma.barbearia.findUnique({
    where: { id: BARBEARIA_PADRAO_ID },
    select: { nome: true, slogan: true },
  }).catch(() => null)
  const nome = loja?.nome ?? BARBEARIA.nome
  const descricao = loja?.slogan || BARBEARIA.slogan
  return {
    title: nome,
    description: `${descricao}. Agende seu horário online com a equipe.`,
    icons: { icon: '/logo.svg', apple: '/icon-192.png' },
  }
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  )
}
