import { NextRequest } from 'next/server'
import { idSchema, listaEsperaAtualizarSchema, listaEsperaSchema } from '@/lib/validation'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/audit'
import { erro, exigir, resp, seguro } from '@/lib/auth'

export const GET = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin', 'barbeiro'])
  if (!r.ok) return r.res
  const filtro = r.user.role === 'barbeiro' ? { OR: [{ barberId: r.user.barberId ?? -1 }, { barberId: null }] } : {}
  const itens = await prisma.listaEspera.findMany({ where: { barbeariaId: r.user.barbeariaId, ...filtro }, orderBy: { criadaEm: 'asc' } })
  return resp({ itens })
})

export const POST = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin', 'barbeiro'])
  if (!r.ok) return r.res
  const p = listaEsperaSchema.safeParse(await req.json().catch(() => null))
  if (!p.success) return erro(400, 'Confira os dados da lista de espera.')
  if (r.user.role === 'barbeiro' && p.data.barberId && p.data.barberId !== r.user.barberId) return erro(403, 'Acesso negado')
  const item = await prisma.listaEspera.create({ data: { barbeariaId: r.user.barbeariaId, clienteNome: p.data.nome, clienteTel: p.data.telefone, servicoId: p.data.servicoId, barberId: r.user.role === 'barbeiro' ? r.user.barberId : p.data.barberId, data: p.data.data, preferencia: p.data.preferencia ?? '' } })
  await audit(req, { acao: 'lista_espera_criada', resultado: 'ok', userId: r.user.id, detalhe: { id: item.id } })
  return resp({ item }, 201)
})

export const DELETE = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin', 'barbeiro'])
  if (!r.ok) return r.res
  const id = idSchema.safeParse(req.nextUrl.searchParams.get('id'))
  const filtro = r.user.role === 'barbeiro' ? { OR: [{ barberId: r.user.barberId ?? -1 }, { barberId: null }] } : {}
  const item = id.success ? await prisma.listaEspera.findFirst({ where: { id: id.data, barbeariaId: r.user.barbeariaId, ...filtro } }) : null
  if (!item) return erro(404, 'Entrada não encontrada')
  await prisma.listaEspera.delete({ where: { id: item.id } })
  await audit(req, { acao: 'lista_espera_removida', resultado: 'ok', userId: r.user.id, detalhe: { id: item.id } })
  return resp({ ok: true })
})

export const PATCH = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin', 'barbeiro'])
  if (!r.ok) return r.res
  const id = idSchema.safeParse(req.nextUrl.searchParams.get('id'))
  const p = listaEsperaAtualizarSchema.safeParse(await req.json().catch(() => null))
  const filtro = r.user.role === 'barbeiro' ? { OR: [{ barberId: r.user.barberId ?? -1 }, { barberId: null }] } : {}
  const item = id.success ? await prisma.listaEspera.findFirst({ where: { id: id.data, barbeariaId: r.user.barbeariaId, ...filtro } }) : null
  if (!item || !p.success) return erro(400, 'Confira a vaga oferecida.')
  const atualizado = await prisma.listaEspera.update({ where: { id: item.id }, data: { status: p.data.status, vagaData: p.data.status === 'ofertada' ? p.data.vagaData : null, vagaHora: p.data.status === 'ofertada' ? p.data.vagaHora : null } })
  await audit(req, { acao: 'lista_espera_atualizada', resultado: 'ok', userId: r.user.id, detalhe: { id: item.id, status: p.data.status } })
  return resp({ item: atualizado })
})
