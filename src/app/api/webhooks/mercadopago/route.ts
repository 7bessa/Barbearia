import { NextRequest, NextResponse } from 'next/server'
import { audit } from '@/lib/audit'
import { assinaturaAssinadaValida, statusBarbeariaGateway } from '@/lib/assinatura'
import { consultarAssinaturaGateway, consultarFaturaGateway, planoGatewayId } from '@/lib/mercado-pago'
import { prisma } from '@/lib/prisma'
import { seguro } from '@/lib/auth'

export const POST = seguro(async (req: NextRequest) => {
  const corpo = await req.json().catch(() => null) as { type?: string; topic?: string; data?: { id?: string | number } } | null
  const id = req.nextUrl.searchParams.get('data.id') ?? (corpo?.data?.id == null ? '' : String(corpo.data.id))
  const tipo = corpo?.type ?? corpo?.topic ?? req.nextUrl.searchParams.get('type') ?? req.nextUrl.searchParams.get('topic') ?? ''
  if (!id || !['subscription_preapproval', 'preapproval', 'subscription_authorized_payment'].includes(tipo)) {
    return NextResponse.json({ recebido: true }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const assinaturaValida = assinaturaAssinadaValida({
    id,
    assinatura: req.headers.get('x-signature'),
    requestId: req.headers.get('x-request-id'),
    segredo: process.env.MERCADO_PAGO_WEBHOOK_SECRET ?? '',
  })
  if (!assinaturaValida) return NextResponse.json({ erro: 'Assinatura inválida' }, { status: 401 })

  if (tipo === 'subscription_authorized_payment') {
    const fatura = await consultarFaturaGateway(id).catch(() => null)
    if (!fatura) return NextResponse.json({ erro: 'Não foi possível consultar a fatura.' }, { status: 502 })
    if (!fatura.preapproval_id) return NextResponse.json({ recebido: true }, { headers: { 'Cache-Control': 'no-store' } })
    const assinaturaFatura = await prisma.assinatura.findUnique({ where: { gatewayId: fatura.preapproval_id } })
    if (!assinaturaFatura) return NextResponse.json({ recebido: true }, { headers: { 'Cache-Control': 'no-store' } })

    const statusPagamento = fatura.payment?.status ?? fatura.summarized ?? fatura.status ?? 'desconhecido'
    await prisma.auditoria.create({
      data: {
        barbeariaId: assinaturaFatura.barbeariaId,
        acao: 'assinatura_fatura_atualizada',
        resultado: statusPagamento === 'approved' ? 'ok' : 'falha',
        detalhe: {
          assinaturaId: assinaturaFatura.id,
          faturaId: String(fatura.id),
          status: statusPagamento.slice(0, 40),
          detalhe: (fatura.payment?.status_detail ?? '').slice(0, 80),
          tentativa: fatura.retry_attempt ?? 0,
          atualizadaEm: fatura.last_modified ?? '',
        },
      },
    })
    return NextResponse.json({ recebido: true }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const gateway = await consultarAssinaturaGateway(id).catch(() => null)
  if (!gateway) return NextResponse.json({ erro: 'Não foi possível consultar a assinatura.' }, { status: 502 })
  if (!gateway.id || !gateway.external_reference || !gateway.preapproval_plan_id) return NextResponse.json({ recebido: true }, { headers: { 'Cache-Control': 'no-store' } })
  const [barbeariaIdTxt, tentativaIdTxt] = gateway.external_reference.split(':')
  const barbeariaId = Number(barbeariaIdTxt)
  const tentativaId = Number(tentativaIdTxt)
  if (!Number.isSafeInteger(barbeariaId) || barbeariaId < 1 || !Number.isSafeInteger(tentativaId) || tentativaId < 1) {
    return NextResponse.json({ recebido: true }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const assinatura = await prisma.assinatura.findFirst({ where: { id: tentativaId, barbeariaId } })
  if (!assinatura) return NextResponse.json({ erro: 'Assinatura ainda não sincronizada.' }, { status: 503 })
  if (assinatura.gatewayPlanoId !== gateway.preapproval_plan_id || planoGatewayId(assinatura.plano) !== gateway.preapproval_plan_id) {
    return NextResponse.json({ recebido: true }, { headers: { 'Cache-Control': 'no-store' } })
  }

  const aplicado = await prisma.$transaction(async (tx) => {
    const atual = await tx.assinatura.findUnique({ where: { id: assinatura.id } })
    if (!atual || (atual.gatewayId !== gateway.id && !atual.gatewayId.startsWith('pending:'))) return false
    await tx.assinatura.update({ where: { id: atual.id }, data: { gatewayId: gateway.id, status: gateway.status } })
    const maisRecente = await tx.assinatura.findFirst({ where: { barbeariaId }, orderBy: { criadaEm: 'desc' } })
    if (maisRecente?.id !== atual.id) return true
    const loja = await tx.barbearia.findUnique({ where: { id: barbeariaId }, select: { testeAte: true } })
    if (!loja) return false
    await tx.barbearia.update({
      where: { id: barbeariaId },
      data: {
        assinaturaStatus: statusBarbeariaGateway(gateway.status, loja.testeAte),
        ...(gateway.status === 'authorized' ? { plano: atual.plano } : {}),
      },
    })
    return true
  })
  if (aplicado) await audit(req, { acao: 'assinatura_status_atualizado', resultado: 'ok', barbeariaId, detalhe: { status: gateway.status } })
  return NextResponse.json({ recebido: true }, { headers: { 'Cache-Control': 'no-store' } })
})

export const dynamic = 'force-dynamic'
