import { NextRequest } from 'next/server'
import { audit } from '@/lib/audit'
import { centavos } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { produtoSchema } from '@/lib/validation'
import { erro, exigir, resp, seguro } from '@/lib/auth'

const paraApi = (produto: { id: number; nome: string; precoCent: number; quantidade: number; estoqueMinimo: number; ativo: boolean }) => ({ ...produto, preco: produto.precoCent / 100 })

export const GET = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin', 'recepcionista'])
  if (!r.ok) return r.res
  const produtos = await prisma.produto.findMany({ where: { barbeariaId: r.user.barbeariaId }, orderBy: { nome: 'asc' } })
  return resp({ produtos: produtos.map(paraApi) })
})

export const POST = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  const p = produtoSchema.safeParse(await req.json().catch(() => null))
  if (!p.success) return erro(400, 'Confira os dados do produto.')
  const produto = await prisma.$transaction(async (tx) => {
    const novo = await tx.produto.create({ data: { barbeariaId: r.user.barbeariaId, nome: p.data.nome, precoCent: centavos(p.data.preco), quantidade: p.data.quantidade, estoqueMinimo: p.data.estoqueMinimo, ativo: p.data.ativo ?? true } })
    if (p.data.quantidade > 0) await tx.movimentoEstoque.create({ data: { barbeariaId: r.user.barbeariaId, produtoId: novo.id, tipo: 'entrada', quantidade: p.data.quantidade, descricao: 'Estoque inicial' } })
    return novo
  })
  await audit(req, { acao: 'produto_criado', resultado: 'ok', userId: r.user.id, detalhe: { id: produto.id } })
  return resp({ produto: paraApi(produto) }, 201)
})
