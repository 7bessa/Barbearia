import { NextRequest } from 'next/server'
import { audit } from '@/lib/audit'
import { periodoDeTesteAtivo, statusBarbeariaGateway } from '@/lib/assinatura'
import { erro, exigir, resp, seguro } from '@/lib/auth'
import { cancelarAssinaturaGateway } from '@/lib/mercado-pago'
import { prisma } from '@/lib/prisma'

export const POST = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  const assinatura = await prisma.assinatura.findFirst({
    where: { barbeariaId: r.user.barbeariaId, status: { in: ['authorized', 'pending'] } },
    orderBy: { criadaEm: 'desc' },
  })
  if (!assinatura || assinatura.gatewayId.startsWith('pending:')) return erro(404, 'Não há uma assinatura pronta para cancelar.')

  const resultado = await cancelarAssinaturaGateway(assinatura.gatewayId).catch(() => null)
  if (resultado?.id !== assinatura.gatewayId || resultado.status !== 'cancelled') {
    await audit(req, { acao: 'assinatura_cancelada', resultado: 'falha', userId: r.user.id })
    return erro(502, 'Não foi possível confirmar o cancelamento. Tente novamente mais tarde.')
  }

  await prisma.$transaction(async (tx) => {
    const atual = await tx.barbearia.findUnique({ where: { id: r.user.barbeariaId }, select: { testeAte: true } })
    if (!atual) throw new Error('Barbearia não encontrada')
    await tx.assinatura.update({ where: { id: assinatura.id }, data: { status: resultado.status } })
    await tx.barbearia.update({
      where: { id: r.user.barbeariaId },
      data: { assinaturaStatus: statusBarbeariaGateway(resultado.status, atual.testeAte) },
    })
  })
  await audit(req, { acao: 'assinatura_cancelada', resultado: 'ok', userId: r.user.id })
  const testeAtivo = await prisma.barbearia.findUnique({ where: { id: r.user.barbeariaId }, select: { assinaturaStatus: true, testeAte: true } })
  return resp({ cancelada: true, testeAtivo: testeAtivo ? periodoDeTesteAtivo(testeAtivo.testeAte) : false })
})

export const dynamic = 'force-dynamic'
