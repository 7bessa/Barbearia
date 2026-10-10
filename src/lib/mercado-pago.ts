import { randomUUID } from 'node:crypto'

const api = 'https://api.mercadopago.com'

export type PlanoMP = {
  id: string
  reason: string
  valor: number
  moeda: string
  frequencia: number
  frequenciaTipo: string
}

export class MercadoPagoHttpError extends Error {
  constructor(readonly status: number) {
    super(`Mercado Pago respondeu ${status}`)
    this.name = 'MercadoPagoHttpError'
  }
}

export const planoGatewayId = (plano: string) => plano === 'profissional'
  ? process.env.MERCADO_PAGO_PLAN_PROFISSIONAL_ID
  : process.env.MERCADO_PAGO_PLAN_ESSENCIAL_ID

function token() {
  const valor = process.env.MERCADO_PAGO_ACCESS_TOKEN
  if (!valor) throw new Error('Mercado Pago não configurado')
  return valor
}

async function requisitar<T>(path: string, init: RequestInit = {}): Promise<T> {
  const resposta = await fetch(`${api}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token()}`,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
    cache: 'no-store',
  })
  if (!resposta.ok) throw new MercadoPagoHttpError(resposta.status)
  return resposta.json() as Promise<T>
}

export async function consultarPlanoGateway(plano: string): Promise<PlanoMP | null> {
  const id = planoGatewayId(plano)
  if (!id) return null
  const dados = await requisitar<{
    id: string
    reason?: string
    auto_recurring?: { transaction_amount?: number; currency_id?: string; frequency?: number; frequency_type?: string }
  }>(`/preapproval_plan/${encodeURIComponent(id)}`)
  const recorrencia = dados.auto_recurring
  if (!recorrencia?.transaction_amount || !recorrencia.currency_id || !recorrencia.frequency || !recorrencia.frequency_type || recorrencia.currency_id !== 'BRL') {
    throw new Error('O plano do Mercado Pago está incompleto')
  }
  return {
    id: dados.id,
    reason: dados.reason ?? (plano === 'profissional' ? 'Barbearia Profissional' : 'Barbearia Essencial'),
    valor: recorrencia.transaction_amount,
    moeda: recorrencia.currency_id,
    frequencia: recorrencia.frequency,
    frequenciaTipo: recorrencia.frequency_type,
  }
}

export async function criarCheckout(args: {
  plano: string
  email: string
  barbeariaId: number
  attemptId: number
}): Promise<{ id: string; status: string; checkoutUrl: string }> {
  const planId = planoGatewayId(args.plano)
  if (!planId) throw new Error('Plano sem ID cadastrado no Mercado Pago')
  const origem = process.env.APP_ORIGIN
  if (!origem) throw new Error('APP_ORIGIN não configurada')
  const backUrl = new URL('/admin/assinatura?retorno=mercadopago', origem).toString()
  const dados = await requisitar<{ id: string; status: string; init_point?: string }>('/preapproval', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': `barbearia-${args.barbeariaId}-checkout-${args.attemptId}` },
    body: JSON.stringify({
      preapproval_plan_id: planId,
      payer_email: args.email,
      external_reference: `${args.barbeariaId}:${args.attemptId}`,
      back_url: backUrl,
      notification_url: `${origem}/api/webhooks/mercadopago`,
    }),
  })
  if (!dados.id || !dados.init_point) throw new Error('O Mercado Pago não retornou o link do checkout')
  const checkout = new URL(dados.init_point)
  if (checkout.protocol !== 'https:' || !/(^|\.)mercadopago\.com(?:\.br)?$/i.test(checkout.hostname)) {
    throw new Error('O Mercado Pago retornou um endereço de checkout inválido')
  }
  return { id: dados.id, status: dados.status ?? 'pending', checkoutUrl: checkout.toString() }
}

export async function consultarAssinaturaGateway(id: string) {
  return requisitar<{
    id: string
    status: string
    external_reference?: string
    preapproval_plan_id?: string
  }>(`/preapproval/${encodeURIComponent(id)}`)
}

export async function consultarFaturaGateway(id: string) {
  return requisitar<{
    id: string | number
    preapproval_id?: string
    status?: string
    summarized?: string
    last_modified?: string
    retry_attempt?: number
    payment?: { id?: string | number; status?: string; status_detail?: string }
  }>(`/authorized_payments/${encodeURIComponent(id)}`)
}

export async function cancelarAssinaturaGateway(id: string) {
  return requisitar<{ id: string; status: string }>(`/preapproval/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'cancelled' }),
    headers: { 'X-Idempotency-Key': `barbearia-cancel-${randomUUID()}` },
  })
}
