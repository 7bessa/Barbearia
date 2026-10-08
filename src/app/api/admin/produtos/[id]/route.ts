import { NextRequest } from 'next/server'
import { audit } from '@/lib/audit'
import { centavos } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { idSchema, produtoPatchSchema } from '@/lib/validation'
import { erro, exigir, resp, seguro } from '@/lib/auth'

type Ctx = { params: Promise<{ id: string }> }
const paraApi = (produto: { id: number; nome: string; precoCent: number; quantidade: number; estoqueMinimo: number; ativo: boolean }) => ({ ...produto, preco: produto.precoCent / 100 })

export const PATCH = seguro(async (req: NextRequest, ctx: Ctx) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  const id = idSchema.safeParse((await ctx.params).id)
  const p = produtoPatchSchema.safeParse(await req.json().catch(() => null))
  if (!id.success || !p.success) return erro(400, 'Dados inválidos')
  const atual = await prisma.produto.findFirst({ where: { id: id.data, barbeariaId: r.user.barbeariaId } })
  if (!atual) return erro(404, 'Produto não encontrado')
  const quantidade = p.data.quantidade
  const produto = await prisma.$transaction(async (tx) => {
    const salvo = await tx.produto.update({ where: { id: atual.id }, data: { ...(p.data.nome === undefined ? {} : { nome: p.data.nome }), ...(p.data.preco === undefined ? {} : { precoCent: centavos(p.data.preco) }), ...(quantidade === undefined ? {} : { quantidade }), ...(p.data.estoqueMinimo === undefined ? {} : { estoqueMinimo: p.data.estoqueMinimo }), ...(p.data.ativo === undefined ? {} : { ativo: p.data.ativo }) } })
    if (quantidade !== undefined && quantidade !== atual.quantidade) await tx.movimentoEstoque.create({ data: { barbeariaId: r.user.barbeariaId, produtoId: atual.id, tipo: 'ajuste', quantidade: quantidade - atual.quantidade, descricao: 'Ajuste manual de estoque' } })
    return salvo
  })
  await audit(req, { acao: 'produto_alterado', resultado: 'ok', userId: r.user.id, detalhe: { id: produto.id } })
  return resp({ produto: paraApi(produto) })
})

export const DELETE = seguro(async (req: NextRequest, ctx: Ctx) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  const id = idSchema.safeParse((await ctx.params).id)
  if (!id.success) return erro(400, 'Produto inválido')
  const produto = await prisma.produto.findFirst({ where: { id: id.data, barbeariaId: r.user.barbeariaId } })
  if (!produto) return erro(404, 'Produto não encontrado')
  await prisma.produto.update({ where: { id: produto.id }, data: { ativo: false } })
  await audit(req, { acao: 'produto_desativado', resultado: 'ok', userId: r.user.id, detalhe: { id: produto.id } })
  return resp({ ok: true })
})
