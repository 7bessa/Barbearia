import { NextRequest } from 'next/server'
import { criarConvite } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { consumir } from '@/lib/rateLimit'
import { audit } from '@/lib/audit'
import { erro, exigir, resp, seguro } from '@/lib/auth'

// Dono gera um código de convite (uso único, validade em BARBEARIA.conviteHoras) para um novo barbeiro.
export const POST = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  if (!(await consumir(`convite:${r.user.id}`, 20, 60 * 60 * 1000))) return erro(429, 'Muitas requisições. Tente mais tarde.')
  const c = await criarConvite(r.user.id, r.user.barbeariaId)
  await audit(req, { acao: 'convite_criado', resultado: 'ok', userId: r.user.id })
  return resp(c, 201) // o código só aparece agora; no servidor fica apenas o hash
})

export const GET = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  return resp({ pendentes: await prisma.convite.count({ where: { barbeariaId: r.user.barbeariaId, usadoPorId: null, expira: { gt: new Date() } } }) })
})
