import { NextRequest } from 'next/server'
import { bloqueioSchema } from '@/lib/validation'
import { agoraBR, dataValida, tm, toBloq } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/audit'
import { erro, exigir, resp, seguro } from '@/lib/auth'

// Barbeiro vê/cria só os dele (folga, almoço, férias). Dono vê/cria de qualquer barbeiro.
export const GET = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['barbeiro', 'recepcionista', 'admin'])
  if (!r.ok) return r.res
  const hoje = agoraBR().slice(0, 10)
  const filtro = Number(req.nextUrl.searchParams.get('barberId'))
  const barberId = r.user.role === 'barbeiro' ? r.user.barberId ?? -1 : filtro || undefined
  const rows = await prisma.bloqueio.findMany({
    where: { barbeariaId: r.user.barbeariaId, data: { gte: hoje }, ...(barberId ? { barberId } : {}) },
    orderBy: [{ data: 'asc' }, { ini: 'asc' }],
  })
  return resp({ bloqueios: rows.map(toBloq) })
})

export const POST = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['barbeiro', 'admin'])
  if (!r.ok) return r.res
  const p = bloqueioSchema.safeParse(await req.json().catch(() => null))
  if (!p.success || !dataValida(p.data.data)) return erro(400, 'Dados inválidos')
  const d = p.data
  const barberId = r.user.role === 'barbeiro' ? r.user.barberId : d.barberId
  if (!barberId || !(await prisma.barbeiro.findFirst({ where: { id: barberId, barbeariaId: r.user.barbeariaId } }))) return erro(400, 'Dados inválidos')
  if (d.data < agoraBR().slice(0, 10)) return erro(400, 'Dados inválidos')
  if ((await prisma.bloqueio.count({ where: { barbeariaId: r.user.barbeariaId, barberId } })) >= 200) return erro(409, 'Limite de bloqueios atingido')

  // Não bloqueia por cima de atendimento marcado: cancele ou remarque antes.
  const marcados = await prisma.agendamento.findMany({ where: { barbeariaId: r.user.barbeariaId, barberId, data: d.data, status: 'agendado' }, select: { hora: true, dur: true } })
  if (marcados.some((a) => tm(d.ini) < tm(a.hora) + a.dur && tm(d.fim) > tm(a.hora))) {
    return erro(409, 'Já existe agendamento nesse período. Cancele ou remarque antes.')
  }

  const k = await prisma.bloqueio.create({ data: { barbeariaId: r.user.barbeariaId, barberId, data: d.data, ini: d.ini, fim: d.fim, motivo: d.motivo ?? '' } })
  await audit(req, { acao: 'bloqueio_criado', resultado: 'ok', userId: r.user.id, detalhe: { id: k.id } })
  return resp({ bloqueio: toBloq(k) }, 201)
})
