import { NextRequest, NextResponse } from 'next/server'
import { idSchema, statusSchema } from '@/lib/validation'
import { agendamentoPorId, centavos, dto, jaPassou, minutosAte } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { BARBEARIA } from '@/config/barbearia'
import { audit } from '@/lib/audit'
import { erro, exigir, seguro, tentativaIndevida } from '@/lib/auth'
import type { Role } from '@/lib/jwt'
import type { Usuario } from '@/lib/db'
import { transicaoStatusPermitida } from '@/lib/regras-agendamento'

type Ctx = { params: Promise<{ id: string }> }
type Carregado =
  | { ok: true; a: NonNullable<Awaited<ReturnType<typeof agendamentoPorId>>>; user: Usuario }
  | { ok: false; res: NextResponse }
const SEM_CACHE = { headers: { 'Cache-Control': 'no-store' } }

// Proteção IDOR: carrega o agendamento e confere se pertence a quem pediu.
// Inexistente e "de outra pessoa" retornam a MESMA resposta (não revela quais IDs existem).
async function carregar(req: NextRequest, ctx: Ctx, roles: Role[]): Promise<Carregado> {
  const r = await exigir(req, roles)
  if (!r.ok) return { ok: false, res: r.res }
  const { id: rawId } = await ctx.params
  const id = idSchema.safeParse(rawId)
  if (!id.success) return { ok: false, res: erro(400, 'Dados inválidos') }
  const { user } = r
  const a = await agendamentoPorId(id.data, user.barbeariaId)
  const dono =
    !!a &&
    (user.role === 'admin' || user.role === 'recepcionista' ||
      (user.role === 'cliente' && a.clienteId === user.id) ||
      (user.role === 'barbeiro' && a.barberId === user.barberId))
  if (!a || !dono) {
    // Só conta como tentativa indevida quando o registro existe e é de outra pessoa;
    // ID inexistente (tela desatualizada) recebe a mesma resposta, sem derrubar a sessão.
    if (a) await tentativaIndevida(r.sid, req, `/api/agendamentos/${id.data}`)
    return { ok: false, res: erro(403, 'Acesso negado') }
  }
  return { ok: true, a, user }
}

export const GET = seguro(async (req: NextRequest, ctx: Ctx) => {
  const x = await carregar(req, ctx, ['cliente', 'barbeiro', 'recepcionista', 'admin'])
  if (!x.ok) return x.res
  return NextResponse.json({ agendamento: dto(x.a, x.user.role !== 'cliente') }, SEM_CACHE)
})

export const PATCH = seguro(async (req: NextRequest, ctx: Ctx) => {
  const x = await carregar(req, ctx, ['cliente', 'barbeiro', 'recepcionista', 'admin'])
  if (!x.ok) return x.res
  const p = statusSchema.safeParse(await req.json().catch(() => null))
  if (!p.success) return erro(400, 'Dados inválidos')
  const { a, user } = x
  const novo = p.data.status

  if (a.status === 'cancelado') return erro(409, 'Agendamento cancelado não pode ser alterado')
  if (a.status === 'concluido') return erro(409, 'Atendimento concluído é preservado no histórico')
  if (!transicaoStatusPermitida(user.role, a.status, novo)) {
    await audit(req, { acao: 'agendamento_status', resultado: 'negado', userId: user.id, detalhe: { id: a.id } })
    return erro(403, 'Acesso negado')
  }
  if (novo === 'cancelado' && a.status !== 'agendado') return erro(409, 'Só é possível cancelar atendimento agendado')
  // Cliente: antecedência mínima. A equipe (barbeiro/dono) pode cancelar a qualquer momento.
  if (novo === 'cancelado' && user.role === 'cliente' && minutosAte(a) < BARBEARIA.cancelamentoHoras * 60) {
    return erro(409, `Cancelamento só com ${BARBEARIA.cancelamentoHoras}h de antecedência. Fale com a barbearia.`)
  }
  if ((novo === 'concluido' || novo === 'faltou') && !jaPassou(a)) return erro(409, 'O atendimento ainda não começou')

  if (novo === 'concluido') {
    // Baixa com pagamento: grava a forma e congela a % de comissão vigente neste momento.
    if (!p.data.formaPagamento) return erro(400, 'Informe a forma de pagamento')
    const itens = p.data.itens ?? []
    let atualizado: boolean
    try { atualizado = await prisma.$transaction(async (tx) => {
      const b = await tx.barbeiro.findFirst({ where: { id: a.barberId, barbeariaId: user.barbeariaId } })
      const idsProdutos = itens.flatMap((item) => item.produtoId ? [item.produtoId] : [])
      const produtos = idsProdutos.length ? await tx.produto.findMany({ where: { barbeariaId: user.barbeariaId, ativo: true, id: { in: idsProdutos } } }) : []
      const itensFinal = itens.map((item) => {
        const produto = item.produtoId ? produtos.find((p) => p.id === item.produtoId) : undefined
        if (item.produtoId && !produto) throw new Error('Produto indisponível')
        return { ...item, descricao: produto?.nome ?? item.descricao, valorUnitCent: produto?.precoCent ?? centavos(item.valorUnitario) }
      })
      const adicionalCent = itensFinal.reduce((total, item) => total + item.valorUnitCent * item.quantidade, 0)
      const r = await tx.agendamento.updateMany({
        where: { id: a.id, barbeariaId: user.barbeariaId, status: a.status },
        data: { status: novo, forma: p.data.formaPagamento, comissaoPct: b?.comissao ?? 0, pagoEm: new Date(), adicionalCent },
      })
      if (r.count !== 1) return false
      if (itensFinal.length) await tx.itemComanda.createMany({ data: itensFinal.map((item) => ({ agendamentoId: a.id, descricao: item.descricao, quantidade: item.quantidade, valorUnitCent: item.valorUnitCent, produtoId: item.produtoId })) })
      for (const item of itensFinal) if (item.produtoId) {
        const baixado = await tx.produto.updateMany({ where: { id: item.produtoId, barbeariaId: user.barbeariaId, quantidade: { gte: item.quantidade } }, data: { quantidade: { decrement: item.quantidade } } })
        if (baixado.count !== 1) throw new Error('Estoque insuficiente')
        await tx.movimentoEstoque.create({ data: { barbeariaId: user.barbeariaId, produtoId: item.produtoId, tipo: 'venda', quantidade: -item.quantidade, descricao: `Venda no atendimento #${a.id}` } })
      }
      return true
    }) } catch (e) {
      if (e instanceof Error && (e.message === 'Produto indisponível' || e.message === 'Estoque insuficiente')) return erro(409, e.message)
      throw e
    }
    if (!atualizado) return erro(409, 'O agendamento mudou. Atualize a tela.')
  } else {
    const r = await prisma.agendamento.updateMany({ where: { id: a.id, barbeariaId: user.barbeariaId, status: a.status }, data: { status: novo, forma: null, comissaoPct: null, pagoEm: null } })
    if (r.count !== 1) return erro(409, 'O agendamento mudou. Atualize a tela.')
  }
  await audit(req, { acao: 'agendamento_status', resultado: 'ok', userId: user.id, detalhe: { id: a.id, status: novo, adicionais: novo === 'concluido' ? (p.data.itens?.length ?? 0) : 0 } })
  const novoA = (await agendamentoPorId(a.id, user.barbeariaId))!
  return NextResponse.json({ agendamento: dto(novoA, user.role !== 'cliente') }, SEM_CACHE)
})

// Exclusão definitiva: só admin.
export const DELETE = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  await audit(req, { acao: 'agendamento_exclusao_bloqueada', resultado: 'negado', userId: r.user.id })
  return erro(409, 'Agendamentos são preservados no histórico. Cancele o atendimento para liberar o horário.')
})
