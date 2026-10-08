import Link from 'next/link'
import { lerSessao, tentativaIndevida } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function Acesso403() {
  const s = await lerSessao()
  if (s) await tentativaIndevida(s.sid, null, '/403') // 3 tentativas => sessão encerrada
  return (
    <main className="grid min-h-screen place-items-center bg-zinc-950 p-6 text-zinc-100">
      <div className="max-w-sm space-y-4 text-center">
        <h1 className="text-5xl font-bold text-amber-400">403</h1>
        <p className="text-zinc-400">Você não tem permissão para acessar esta página.</p>
        <Link href="/login" className="inline-block rounded-md bg-amber-400 px-4 py-2 font-semibold text-zinc-950">
          Voltar ao login
        </Link>
      </div>
    </main>
  )
}
