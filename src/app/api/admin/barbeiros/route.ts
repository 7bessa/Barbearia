import { NextRequest } from 'next/server'
import { barbeiroSchema } from '@/lib/validation'
import { toBarb } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/audit'
import { erro, exigir, resp, seguro } from '@/lib/auth'
import { limiteDoPlano } from '@/lib/planos'

export const GET = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin', 'recepcionista'])
  if (!r.ok) return r.res
  const rows = await prisma.barbeiro.findMany({ where: { barbeariaId: r.user.barbeariaId }, orderBy: { id: 'asc' }, include: { _count: { select: { usuarios: true } } } })
  return resp({ barbeiros: rows.map((b) => ({ ...toBarb(b), temLogin: b._count.usuarios > 0 })) })
})

export const POST = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  const p = barbeiroSchema.safeParse(await req.json().catch(() => null))
  if (!p.success) return erro(400, 'Dados inválidos')
  const [barbearia, ativos] = await Promise.all([
    prisma.barbearia.findUnique({ where: { id: r.user.barbeariaId }, select: { plano: true } }),
    prisma.barbeiro.count({ where: { barbeariaId: r.user.barbeariaId, ativo: true } }),
  ])
  if (!barbearia) return erro(404, 'Barbearia não encontrada')
  const limite = limiteDoPlano(barbearia.plano)
  if (p.data.ativo !== false && ativos >= limite.profissionais) return erro(403, `O plano ${barbearia.plano === 'profissional' ? 'Profissional' : 'Essencial'} permite até ${limite.profissionais} profissional(is) ativo(s).`)
  const b = await prisma.barbeiro.create({ data: { barbeariaId: r.user.barbeariaId, nome: p.data.nome, foto: p.data.foto ?? '', comissao: p.data.comissao, ativo: p.data.ativo ?? true } })
  await audit(req, { acao: 'barbeiro_criado', resultado: 'ok', userId: r.user.id, detalhe: { id: b.id } })
  return resp({ barbeiro: toBarb(b) }, 201)
})
