import { NextRequest } from 'next/server'
import { randomUUID } from 'node:crypto'
import { audit } from '@/lib/audit'
import { erro, exigir, resp, seguro } from '@/lib/auth'
import { limiteDoPlano, nomePlano } from '@/lib/planos'
import { prisma } from '@/lib/prisma'
import { conflito } from '@/lib/db'
import { criarCheckout, consultarPlanoGateway, MercadoPagoHttpError, planoGatewayId } from '@/lib/mercado-pago'
import { periodoDeTesteAtivo } from '@/lib/assinatura'

export const GET = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  const [barbearia, assinatura] = await Promise.all([
    prisma.barbearia.findUnique({ where: { id: r.user.barbeariaId }, select: { nome: true, plano: true, assinaturaStatus: true, testeAte: true } }),
    prisma.assinatura.findFirst({ where: { barbeariaId: r.user.barbeariaId }, orderBy: { criadaEm: 'desc' } }),
  ])
  if (!barbearia) return erro(404, 'Barbearia não encontrada')
  const ultimaFatura = await prisma.auditoria.findFirst({
    where: {
      barbeariaId: r.user.barbeariaId,
      acao: 'assinatura_fatura_atualizada',
      ...(assinatura ? { detalhe: { path: ['assinaturaId'], equals: assinatura.id } } : {}),
    },
    orderBy: { id: 'desc' },
    select: { ts: true, detalhe: true },
  })

  const planos = await Promise.all(['essencial', 'profissional'].map(async (plano) => {
    try {
      const dados = await consultarPlanoGateway(plano)
      return { plano, nome: nomePlano(plano), limites: limiteDoPlano(plano), configurado: !!dados, ...dados }
    } catch {
      return { plano, nome: nomePlano(plano), limites: limiteDoPlano(plano), configurado: false }
    }
  }))
  return resp({
    barbearia,
    planos,
    assinatura: assinatura ? {
      plano: assinatura.plano,
      status: assinatura.status,
      checkoutUrl: assinatura.status === 'pending' ? assinatura.checkoutUrl : null,
      criadaEm: assinatura.criadaEm.toISOString(),
    } : null,
    ultimaFatura: ultimaFatura ? (() => {
      const detalhe = ultimaFatura.detalhe as Record<string, unknown>
      return {
        status: typeof detalhe.status === 'string' ? detalhe.status : 'desconhecido',
        detalhe: typeof detalhe.detalhe === 'string' ? detalhe.detalhe : '',
        tentativa: typeof detalhe.tentativa === 'number' ? detalhe.tentativa : 0,
        recebidaEm: ultimaFatura.ts.toISOString(),
      }
    })() : null,
    testeAtivo: periodoDeTesteAtivo(barbearia.testeAte),
    configuracaoPronta: !!(
      process.env.MERCADO_PAGO_ACCESS_TOKEN
      && process.env.MERCADO_PAGO_WEBHOOK_SECRET
      && process.env.MERCADO_PAGO_PLAN_ESSENCIAL_ID
      && process.env.MERCADO_PAGO_PLAN_PROFISSIONAL_ID
    ),
  })
})

export const POST = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  const body = await req.json().catch(() => null) as { plano?: unknown } | null
  if (body?.plano !== 'essencial' && body?.plano !== 'profissional') return erro(400, 'Escolha um dos planos disponíveis.')
  if (!r.user.email) return erro(400, 'Adicione um e-mail à conta antes de contratar um plano.')
  const gatewayPlanId = planoGatewayId(body.plano)
  if (!process.env.MERCADO_PAGO_ACCESS_TOKEN || !process.env.MERCADO_PAGO_WEBHOOK_SECRET || !gatewayPlanId) {
    return erro(503, 'A contratação online ainda não está configurada.')
  }

  const atual = await prisma.barbearia.findUnique({ where: { id: r.user.barbeariaId }, select: { plano: true, assinaturaStatus: true, testeAte: true } })
  if (!atual) return erro(404, 'Barbearia não encontrada')
  const ativaNoGateway = await prisma.assinatura.findFirst({ where: { barbeariaId: r.user.barbeariaId, status: 'authorized' }, select: { id: true } })
  if (ativaNoGateway) return erro(409, 'Já existe uma assinatura ativa. Fale com o suporte para mudar de plano.')
  const aberta = await prisma.assinatura.findFirst({
    where: { barbeariaId: r.user.barbeariaId, status: { in: ['criando', 'pending'] } },
    orderBy: { criadaEm: 'desc' },
  })
  let tentativa = aberta
  if (aberta) {
    if (aberta.plano !== body.plano) return erro(409, 'Já existe uma contratação em andamento. Continue o pagamento ou cancele a tentativa antes de trocar de plano.')
    if (aberta.status === 'pending' && aberta.checkoutUrl) return resp({ checkoutUrl: aberta.checkoutUrl })
    if (aberta.status !== 'criando') return erro(409, 'Atualize a página e continue a contratação em andamento.')
  }
  const limite = limiteDoPlano(body.plano)
  const [profissionais, cadeiras] = await Promise.all([
    prisma.barbeiro.count({ where: { barbeariaId: r.user.barbeariaId, ativo: true } }),
    prisma.barbearia.findUnique({ where: { id: r.user.barbeariaId }, select: { capacidadeCadeiras: true } }),
  ])
  if (profissionais > limite.profissionais || (cadeiras?.capacidadeCadeiras ?? 1) > limite.cadeiras) {
    return erro(409, 'Esse plano não comporta a quantidade atual de profissionais ou cadeiras. Ajuste a equipe antes de trocar de plano.')
  }
  if (!tentativa) {
    try {
      tentativa = await prisma.assinatura.create({
        data: { barbeariaId: r.user.barbeariaId, gatewayId: `pending:${randomUUID()}`, gatewayPlanoId: gatewayPlanId, plano: body.plano, status: 'criando' },
      })
    } catch (e) {
      if (conflito(e)) return erro(409, 'Já existe uma contratação em andamento. Atualize a tela e continue o pagamento existente.')
      throw e
    }
  }
  try {
    const checkout = await criarCheckout({ plano: body.plano, email: r.user.email, barbeariaId: r.user.barbeariaId, attemptId: tentativa.id })
    const sincronizada = await prisma.assinatura.updateMany({
      where: { id: tentativa.id, gatewayId: tentativa.gatewayId, status: 'criando' },
      data: { gatewayId: checkout.id, status: checkout.status, checkoutUrl: checkout.checkoutUrl },
    })
    if (sincronizada.count !== 1) {
      const atual = await prisma.assinatura.findUnique({ where: { id: tentativa.id } })
      if (atual?.gatewayId !== checkout.id) throw new Error('A tentativa de checkout mudou durante a sincronização')
    }
    await audit(req, { acao: 'assinatura_checkout_criado', resultado: 'ok', userId: r.user.id, detalhe: { plano: body.plano } })
    return resp({ checkoutUrl: checkout.checkoutUrl }, 201)
  } catch (e) {
    const rejeicaoDefinitiva = e instanceof MercadoPagoHttpError && e.status >= 400 && e.status < 500 && ![408, 409, 429].includes(e.status)
    if (rejeicaoDefinitiva) {
      await prisma.assinatura.updateMany({ where: { id: tentativa.id, status: 'criando' }, data: { status: 'failed' } })
    }
    await audit(req, { acao: 'assinatura_checkout_criado', resultado: 'falha', userId: r.user.id, detalhe: { plano: body.plano } })
    return erro(502, rejeicaoDefinitiva
      ? 'O Mercado Pago recusou esta tentativa. Confira a configuração e tente novamente.'
      : 'Não foi possível confirmar a contratação agora. Tente novamente; a mesma tentativa será retomada sem gerar outra cobrança.')
  }
})

export const dynamic = 'force-dynamic'
