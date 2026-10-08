import { NextRequest } from 'next/server'
import { idSchema, notaSchema } from '@/lib/validation'
import { equipeAcessaCliente, toNota, usuarioPorId } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { consumir } from '@/lib/rateLimit'
import { audit } from '@/lib/audit'
import { erro, exigir, resp, seguro, tentativaIndevida } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }

// Observações internas (ex.: "degradê 1 nas laterais", "prefere conversar pouco"). O cliente nunca as vê.
// Evite dados sensíveis (saúde, religião, etc.): LGPD.
export const POST = seguro(async (req: NextRequest, ctx: Ctx) => {
  const { id: rawId } = await ctx.params
  const r = await exigir(req, ['barbeiro', 'admin'])
  if (!r.ok) return r.res
  const id = idSchema.safeParse(rawId)
  const c = id.success ? await usuarioPorId(id.data, r.user.barbeariaId) : undefined
  if (!c || c.role !== 'cliente' || !(await equipeAcessaCliente(r.user, c.id))) {
    await tentativaIndevida(r.sid, req, '/api/clientes/:id/notas')
    return erro(403, 'Acesso negado')
  }
  if (!(await consumir(`nota:${r.user.id}`, 60, 60 * 60 * 1000))) return erro(429, 'Muitas requisições. Tente mais tarde.')
  const p = notaSchema.safeParse(await req.json().catch(() => null))
  if (!p.success) return erro(400, 'Dados inválidos')
  if ((await prisma.nota.count({ where: { barbeariaId: r.user.barbeariaId, clienteId: c.id } })) >= 100) return erro(409, 'Limite de observações atingido')

  const n = await prisma.nota.create({ data: { barbeariaId: r.user.barbeariaId, clienteId: c.id, autorId: r.user.id, autorNome: r.user.nome, texto: p.data.texto } })
  await audit(req, { acao: 'nota_criada', resultado: 'ok', userId: r.user.id, detalhe: { clienteId: c.id } })
  return resp({ nota: toNota(n) }, 201)
})

// Apaga uma observação: ?notaId=N. Só o autor ou o dono.
export const DELETE = seguro(async (req: NextRequest, ctx: Ctx) => {
  const { id: rawId } = await ctx.params
  const r = await exigir(req, ['barbeiro', 'admin'])
  if (!r.ok) return r.res
  const cid = idSchema.safeParse(rawId)
  const nid = idSchema.safeParse(req.nextUrl.searchParams.get('notaId'))
  const n = cid.success && nid.success ? await prisma.nota.findFirst({ where: { barbeariaId: r.user.barbeariaId, id: nid.data, clienteId: cid.data } }) : null
  if (!n || (r.user.role !== 'admin' && n.autorId !== r.user.id)) {
    await tentativaIndevida(r.sid, req, '/api/clientes/:id/notas')
    return erro(403, 'Acesso negado')
  }
  await prisma.nota.deleteMany({ where: { id: n.id, barbeariaId: r.user.barbeariaId } })
  await audit(req, { acao: 'nota_removida', resultado: 'ok', userId: r.user.id, detalhe: { id: n.id } })
  return resp({ ok: true })
})
