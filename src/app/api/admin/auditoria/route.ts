import { NextRequest } from 'next/server'
import { ultimosEventos } from '@/lib/audit'
import { exigir, resp, seguro } from '@/lib/auth'

// Últimos eventos de segurança (login, acesso negado, CSRF...). Em produção, use também um serviço de logs.
export const GET = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  return resp({ eventos: await ultimosEventos(r.user.barbeariaId) })
})
