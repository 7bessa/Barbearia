import { NextRequest, NextResponse } from 'next/server'
import { COOKIES, verificarAcesso, type Role } from '@/lib/jwt'

const prod = process.env.NODE_ENV === 'production'
const AREAS: Record<string, Role> = { '/cliente': 'cliente', '/barbeiro': 'barbeiro', '/recepcao': 'recepcionista', '/admin': 'admin' }

function csp(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${prod ? '' : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(prod ? ['upgrade-insecure-requests'] : []),
  ].join('; ')
}

const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => b.toString(16).padStart(2, '0')).join('')

export async function middleware(req: NextRequest) {
  // HTTPS obrigatório em produção (atrás de proxy)
  if (prod && req.headers.get('x-forwarded-proto') === 'http') {
    const url = req.nextUrl.clone()
    url.protocol = 'https:'
    return NextResponse.redirect(url, 308)
  }

  const { pathname } = req.nextUrl
  const area = Object.keys(AREAS).find((a) => pathname === a || pathname.startsWith(a + '/'))

  if (area) {
    const token = req.cookies.get(COOKIES.at)?.value
    const sessao = token ? await verificarAcesso(token) : null
    const url = req.nextUrl.clone()
    url.search = ''
    if (!sessao) {
      // Access token expirou mas ainda há refresh token: tenta renovar e volta para a página.
      if (req.cookies.get(COOKIES.rt)) {
        url.pathname = '/api/auth/refresh'
        url.search = `?next=${encodeURIComponent(pathname)}`
      } else {
        url.pathname = '/login'
      }
      return NextResponse.redirect(url)
    }
    if (sessao.role !== AREAS[area]) {
      url.pathname = '/403' // a página /403 registra a tentativa e pode bloquear a sessão
      return NextResponse.redirect(url)
    }
  }

  // CSP com nonce (somente em produção, para não atrapalhar o hot reload do localhost)
  let res = NextResponse.next()
  if (prod) {
    const nonce = btoa(crypto.randomUUID())
    const politica = csp(nonce)
    const headers = new Headers(req.headers)
    headers.set('x-nonce', nonce)
    headers.set('Content-Security-Policy', politica)
    res = NextResponse.next({ request: { headers } })
    res.headers.set('Content-Security-Policy', politica)
  }
  if (!req.cookies.get(COOKIES.csrf)) {
    res.cookies.set(COOKIES.csrf, hex(32), { httpOnly: false, secure: prod, sameSite: 'strict', path: '/' })
  }
  res.headers.set('Referrer-Policy', 'no-referrer')
  res.headers.set('X-Content-Type-Options', 'nosniff')
  res.headers.set('X-Frame-Options', 'DENY')
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  if (pathname === '/verificar-email' || pathname === '/redefinir-senha') {
    res.headers.set('Cache-Control', 'no-store')
  }
  return res
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] }
