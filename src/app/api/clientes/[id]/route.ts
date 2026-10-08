import { NextRequest } from 'next/server'
import { idSchema } from '@/lib/validation'
import { equipeAcessaCliente, toNota, usuarioPorId } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { erro, exigir, resp, seguro, tentativaIndevida } from '@/lib/auth'

// Ficha do cliente: dados, resumo, histórico de atendimentos e observações da equipe.
export const GET = seguro(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const { id: rawId } = await ctx.params
  const r = await exigir(req, ['barbeiro', 'admin'])
  if (!r.ok) return r.res
  const { user } = r
  const id = idSchema.safeParse(rawId)
  const c = id.success ? await usuarioPorId(id.data, user.barbeariaId) : undefined
  if (!c || c.role !== 'cliente' || !(await equipeAcessaCliente(user, c.id))) {
    await tentativaIndevida(r.sid, req, '/api/clientes/:id') // mesma resposta para inexistente e proibido
    return erro(403, 'Acesso negado')
  }

  const admin = user.role === 'admin'
  const ags = await prisma.agendamento.findMany({
    where: { barbeariaId: user.barbeariaId, clienteId: c.id, ...(admin ? {} : { barberId: user.barberId ?? -1 }) }, // barbeiro só vê o que é dele
    orderBy: [{ data: 'desc' }, { hora: 'desc' }],
    include: { servico: { select: { nome: true } }, barbeiro: { select: { nome: true } } },
  })
  const feitos = ags.filter((a) => a.status === 'concluido')
  const notas = await prisma.nota.findMany({ where: { barbeariaId: user.barbeariaId, clienteId: c.id }, orderBy: { criadaEm: 'desc' } })

  return resp({
    cliente: { id: c.id, nome: c.nome, telefone: c.telefone, semConta: !!c.semConta, ...(admin ? { email: c.email } : {}) },
    resumo: {
      visitas: feitos.length,
      faltas: ags.filter((a) => a.status === 'faltou').length,
      cancelados: ags.filter((a) => a.status === 'cancelado').length,
      ultimoAtendimento: feitos[0]?.data ?? null,
      ...(admin ? { totalGasto: feitos.reduce((s, a) => s + a.precoCent, 0) / 100 } : {}),
    },
    historico: ags.slice(0, 100).map((a) => ({
      id: a.id, data: a.data, hora: a.hora, status: a.status, valor: a.precoCent / 100, forma: a.forma ?? null,
      servico: a.servico.nome, barbeiro: a.barbeiro.nome,
    })),
    notas: notas.map(toNota),
  })
})
