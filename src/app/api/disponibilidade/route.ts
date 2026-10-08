import { NextRequest } from 'next/server'
import { dataSchema, idSchema } from '@/lib/validation'
import { horariosLivres } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { consumir } from '@/lib/rateLimit'
import { erro, exigir, resp, seguro } from '@/lib/auth'

// Horários livres: ?barberId=&servicoId=&data=YYYY-MM-DD
export const GET = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['cliente', 'barbeiro', 'admin'])
  if (!r.ok) return r.res
  if (!(await consumir(`disp:${r.user.id}`, 300, 60 * 60 * 1000))) return erro(429, 'Muitas requisições. Tente mais tarde.')
  const q = req.nextUrl.searchParams
  const { barbeariaId } = r.user
  const b = idSchema.safeParse(q.get('barberId'))
  const s = idSchema.safeParse(q.get('servicoId'))
  const d = dataSchema.safeParse(q.get('data'))
  if (!b.success || !s.success || !d.success) return erro(400, 'Dados inválidos')
  const [sv, bb] = await Promise.all([
    prisma.servico.findFirst({ where: { id: s.data, barbeariaId, ativo: true } }),
    prisma.barbeiro.findFirst({ where: { id: b.data, barbeariaId, ativo: true } }),
  ])
  if (!sv || !bb) return erro(400, 'Dados inválidos')
  return resp({ horarios: await horariosLivres(barbeariaId, bb.id, d.data, sv.dur, r.user.role !== 'cliente') })
})
