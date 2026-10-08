import { NextRequest, NextResponse } from 'next/server'
import { erro, limparCookies, renovarSessao, seguro, verificarCsrf } from '@/lib/auth'

const base = (req: NextRequest) => process.env.APP_ORIGIN ?? req.nextUrl.origin
// Aceita só caminhos internos dos painéis (evita open redirect).
const destino = (n: string | null) => (n && /^\/(cliente|barbeiro|admin)(\/[\w-]*)*$/.test(n) ? n : '/login')

// GET: usado pelo middleware quando o access token expirou (navegação). SameSite=Strict + Sec-Fetch-Site.
export const GET = seguro(async (req: NextRequest) => {
  const site = req.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') return erro(403, 'Requisição inválida')
  const res = NextResponse.redirect(new URL(destino(req.nextUrl.searchParams.get('next')), base(req)))
  const u = await renovarSessao(req, res)
  if (!u) {
    const fim = NextResponse.redirect(new URL('/login', base(req)))
    limparCookies(fim)
    return fim
  }
  return res
})

// POST: usado pelo front (api-client) ao receber 401.
export const POST = seguro(async (req: NextRequest) => {
  if (!verificarCsrf(req)) return erro(403, 'Requisição inválida')
  const res = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  const u = await renovarSessao(req, res) // grava os novos cookies em "res"
  if (!u) return erro(401, 'Não autenticado')
  return res
})
