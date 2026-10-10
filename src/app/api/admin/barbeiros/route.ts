import { NextRequest } from 'next/server'
import { barbeiroSchema } from '@/lib/validation'
import { criarBarbeiroDentroDoPlano, LimitePlanoAtingido, toBarb } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { audit } from '@/lib/audit'
import { erro, exigir, resp, seguro } from '@/lib/auth'

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
  let b
  try {
    if (p.data.ativo === false) {
      const loja = await prisma.barbearia.findUnique({ where: { id: r.user.barbeariaId }, select: { id: true } })
      if (!loja) return erro(404, 'Barbearia não encontrada')
      b = await prisma.barbeiro.create({ data: { barbeariaId: loja.id, nome: p.data.nome, foto: p.data.foto ?? '', comissao: p.data.comissao, ativo: false } })
    } else {
      b = await criarBarbeiroDentroDoPlano({ barbeariaId: r.user.barbeariaId, nome: p.data.nome, foto: p.data.foto ?? '', comissao: p.data.comissao, ativo: true })
    }
  } catch (e) {
    if (e instanceof LimitePlanoAtingido) return erro(403, `O plano atual permite até ${e.limite} profissional(is) ativo(s).`)
    throw e
  }
  await audit(req, { acao: 'barbeiro_criado', resultado: 'ok', userId: r.user.id, detalhe: { id: b.id } })
  return resp({ barbeiro: toBarb(b) }, 201)
})
