import type { ReactNode } from 'react'

export function Pagina({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-10 text-zinc-300">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-3xl font-bold text-zinc-100">{titulo}</h1>
        {children}
      </div>
    </main>
  )
}

export function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xl font-semibold text-amber-400">{titulo}</h2>
      {children}
    </section>
  )
}
