import { createHmac, timingSafeEqual } from 'node:crypto'

export type StatusGateway = 'authorized' | 'pending' | 'cancelled' | 'paused' | string

export function periodoDeTesteAtivo(testeAte: Date | string | null | undefined, agora = new Date()) {
  return !!testeAte && new Date(testeAte).getTime() > agora.getTime()
}

export function acessoAssinaturaAtivo(status: string, testeAte: Date | string | null | undefined, agora = new Date()) {
  return status === 'ativa' || (status === 'teste' && periodoDeTesteAtivo(testeAte, agora))
}

export function statusBarbeariaGateway(status: StatusGateway, testeAte: Date | string | null | undefined, agora = new Date()) {
  if (status === 'authorized') return 'ativa'
  if (periodoDeTesteAtivo(testeAte, agora)) return 'teste'
  if (status === 'paused') return 'suspensa'
  if (status === 'cancelled') return 'cancelada'
  return 'pendente'
}

export function assinaturaAssinadaValida(args: {
  id: string
  assinatura: string | null
  requestId: string | null
  segredo: string
}) {
  if (!args.assinatura || !args.requestId || !args.segredo) return false
  const campos = Object.fromEntries(args.assinatura.split(',').map((parte) => {
    const [chave, ...valor] = parte.trim().split('=')
    return [chave, valor.join('=')]
  }))
  const ts = campos.ts
  const assinatura = campos.v1
  if (!ts || !/^[a-f0-9]{64}$/i.test(assinatura ?? '')) return false
  const manifesto = `id:${args.id.toLowerCase()};request-id:${args.requestId};ts:${ts};`
  const esperado = createHmac('sha256', args.segredo).update(manifesto).digest('hex')
  const recebido = Buffer.from(assinatura, 'hex')
  const calculado = Buffer.from(esperado, 'hex')
  return recebido.length === calculado.length && timingSafeEqual(recebido, calculado)
}
