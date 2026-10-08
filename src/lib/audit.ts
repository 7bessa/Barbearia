import type { NextRequest } from 'next/server'
import { prisma } from './prisma'

// Em produção só confia no cabeçalho se TRUST_PROXY=1 (você está atrás de Vercel/Cloudflare/Nginx que o reescreve).
// Sem isso, qualquer um forjaria o IP e burlaria o rate limit.
const confiaProxy = process.env.NODE_ENV !== 'production' || process.env.TRUST_PROXY === '1'
export function getIp(req: NextRequest) {
  if (!confiaProxy) return 'desconhecido'
  const xf = req.headers.get('x-forwarded-for')
  return (xf ? xf.split(',')[0].trim() : req.headers.get('x-real-ip')) || 'desconhecido'
}

type Evento = {
  acao: string
  resultado: 'ok' | 'falha' | 'negado'
  userId?: number | null
  barbeariaId?: number | null
  detalhe?: Record<string, string | number | boolean>
}

const PROIBIDO = /senha|token|cookie|authorization|secret/i

// Grava no banco (tabela Auditoria) e no log do servidor. Falha de log nunca derruba a requisição.
export async function audit(req: NextRequest | null, ev: Evento) {
  const detalhe: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(ev.detalhe ?? {})) if (!PROIBIDO.test(k)) detalhe[k] = v
  const linha = {
    ip: req ? getIp(req) : null,
    ua: req?.headers.get('user-agent')?.slice(0, 120) ?? null,
    acao: ev.acao,
    resultado: ev.resultado,
    userId: ev.userId ?? null,
    detalhe,
  }
  console.info(JSON.stringify({ ts: new Date().toISOString(), ...linha }))
  try {
    const barbeariaId = ev.barbeariaId ?? (ev.userId
      ? (await prisma.usuario.findUnique({ where: { id: ev.userId }, select: { barbeariaId: true } }))?.barbeariaId ?? null
      : null)
    await prisma.auditoria.create({ data: { ...linha, barbeariaId } })
    if (Math.random() < 0.01) await prisma.auditoria.deleteMany({ where: { ts: { lt: new Date(Date.now() - 90 * 864e5) } } }) // retenção: 90 dias (contêm IP)
  } catch (e) {
    console.error('[audit]', e instanceof Error ? e.message : 'falha')
  }
}

export const ultimosEventos = (barbeariaId: number) => prisma.auditoria.findMany({ where: { barbeariaId }, orderBy: { id: 'desc' }, take: 100 })
