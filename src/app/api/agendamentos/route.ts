import { NextRequest } from 'next/server'
import { agendamentoSchema, dataSchema } from '@/lib/validation'
import { agendar, dto, equipeAcessaCliente, toAg, usuarioPorId } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { consumir } from '@/lib/rateLimit'
import { audit } from '@/lib/audit'
import { erro, exigir, resp, seguro } from '@/lib/auth'

// Cada papel só enxerga o que é seu (a lista vem filtrada no servidor).
export const GET = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['cliente', 'barbeiro', 'recepcionista', 'admin'])
  if (!r.ok) return r.res
  const { user } = r
  const data = req.nextUrl.searchParams.get('data')
  if (data && !dataSchema.safeParse(data).success) return erro(400, 'Data inválida')
  const where = {
    ...(user.role === 'cliente' ? { barbeariaId: user.barbeariaId, clienteId: user.id } : user.role === 'barbeiro' ? { barbeariaId: user.barbeariaId, barberId: user.barberId ?? -1 } : { barbeariaId: user.barbeariaId }),
    ...(data ? { data } : {}),
  }
  const rows = await prisma.agendamento.findMany({ where, orderBy: [{ data: 'desc' }, { hora: 'desc' }], take: 1000 })
  return resp({ agendamentos: rows.map((a) => dto(toAg(a), user.role !== 'cliente')) })
})

// Cliente agenda para si. Barbeiro/dono agendam para um cliente (inclusive de balcão).
// Preço, duração e dados do cliente vêm sempre do servidor.
export const POST = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['cliente', 'barbeiro', 'recepcionista', 'admin'])
  if (!r.ok) return r.res
  const { user } = r
  if (!(await consumir(`agendar:${user.id}`, 60, 60 * 60 * 1000))) return erro(429, 'Muitas requisições. Tente mais tarde.')

  const p = agendamentoSchema.safeParse(await req.json().catch(() => null))
  if (!p.success) return erro(400, 'Dados inválidos')
  const { servicoId, barberId, data, hora } = p.data
  const equipe = user.role !== 'cliente'

  let alvo = user
  if (equipe) {
    const c = p.data.clienteId ? await usuarioPorId(p.data.clienteId, user.barbeariaId) : undefined
    // Barbeiro só agenda para cliente que já atendeu ou que ele mesmo cadastrou (evita varrer IDs e colher nome/telefone).
    if (!c || c.role !== 'cliente' || !(await equipeAcessaCliente(user, c.id))) return erro(400, 'Dados inválidos')
    if (user.role === 'barbeiro' && barberId !== user.barberId) return erro(403, 'Acesso negado')
    alvo = c
  }

  const [sv, barbeiro] = await Promise.all([
    prisma.servico.findFirst({ where: { id: servicoId, barbeariaId: user.barbeariaId, ativo: true } }),
    prisma.barbeiro.findFirst({ where: { id: barberId, barbeariaId: user.barbeariaId, ativo: true } }),
  ])
  if (!sv || !barbeiro) return erro(400, 'Dados inválidos')

  const x = await agendar(user.barbeariaId, alvo, { id: sv.id, dur: sv.dur, preco: sv.precoCent / 100 }, barberId, data, hora, equipe)
  if (!x.ok) return erro(409, 'Horário indisponível')
  await audit(req, { acao: 'agendamento_criado', resultado: 'ok', userId: user.id, detalhe: { id: x.a.id } })
  return resp({ agendamento: dto(x.a, equipe) }, 201)
})
