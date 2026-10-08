import { NextRequest } from 'next/server'
import { horarioSchema } from '@/lib/validation'
import { getHorario, salvarHorario } from '@/lib/db'
import { audit } from '@/lib/audit'
import { erro, exigir, resp, seguro } from '@/lib/auth'

export const GET = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  return resp({ horario: await getHorario(r.user.barbeariaId) })
})

export const PUT = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  const p = horarioSchema.safeParse(await req.json().catch(() => null))
  if (!p.success) return erro(400, 'Dados inválidos')
  const horario = await salvarHorario(r.user.barbeariaId, {
    abre: p.data.abre, fecha: p.data.fecha, almocoIni: p.data.almocoIni ?? null, almocoFim: p.data.almocoFim ?? null,
    dias: Array.from(new Set(p.data.dias)).sort(),
  })
  await audit(req, { acao: 'horario_alterado', resultado: 'ok', userId: r.user.id })
  return resp({ horario })
})
