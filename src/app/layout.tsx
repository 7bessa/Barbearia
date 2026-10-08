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
    select: { nome: true },
  }).catch(() => null)
  return { title: loja?.nome ?? BARBEARIA.nome }
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="bg-zinc-950 text-zinc-100 antialiased">{children}</body>
    </html>
  )
}
