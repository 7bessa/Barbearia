import { NextRequest } from 'next/server'
import { getHorario } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { exigir, resp, seguro } from '@/lib/auth'

// Dados que o cliente precisa para agendar (somente itens ativos, sem comissão).
export const GET = seguro(async (req: NextRequest) => {
  const r = await exigir(req)
  if (!r.ok) return r.res
  const { barbeariaId } = r.user
  const [barbeiros, servicos, horario, barbearia] = await Promise.all([
    prisma.barbeiro.findMany({ where: { barbeariaId, ativo: true }, orderBy: { id: 'asc' }, select: { id: true, nome: true, foto: true } }),
    prisma.servico.findMany({ where: { barbeariaId, ativo: true }, orderBy: { id: 'asc' } }),
    getHorario(barbeariaId),
    prisma.barbearia.findUniqueOrThrow({ where: { id: barbeariaId }, select: { nome: true, slogan: true, slug: true, corPrimaria: true, capacidadeCadeiras: true } }),
  ])
  return resp({
    barbearia,
    barbeiros,
    servicos: servicos.map((s) => ({ id: s.id, nome: s.nome, preco: s.precoCent / 100, dur: s.dur })),
    horario,
  })
})
