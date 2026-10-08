// Cliente de API do front: envia o token CSRF e tenta renovar a sessão uma vez ao receber 401.
const NOME_CSRF = process.env.NODE_ENV === 'production' ? '__Host-bb_csrf' : 'bb_csrf'

function csrf() {
  const c = document.cookie.split('; ').find((x) => x.startsWith(NOME_CSRF + '='))
  return c ? c.slice(NOME_CSRF.length + 1) : ''
}

export async function api<T = { erro?: string }>(url: string, init: RequestInit = {}, tentou = false) {
  const metodo = (init.method ?? 'GET').toUpperCase()
  const headers = new Headers(init.headers)
  if (init.body) headers.set('Content-Type', 'application/json')
  if (metodo !== 'GET') headers.set('x-csrf-token', csrf())

  const r = await fetch(url, { ...init, headers, credentials: 'same-origin' })
  // Rotas protegidas podem redirecionar para /login antes de responder JSON.
  // Sem este tratamento, componentes exibiam um erro genérico e ficavam presos carregando.
  if (r.redirected && new URL(r.url).pathname === '/login') {
    if (typeof window !== 'undefined') window.location.href = '/login'
    return { ok: false, status: 401, data: null as T | null }
  }
  if (r.status === 401 && !tentou && !url.startsWith('/api/auth/')) {
    const rf = await fetch('/api/auth/refresh', { method: 'POST', headers: { 'x-csrf-token': csrf() }, credentials: 'same-origin' })
    if (rf.ok) return api<T>(url, init, true)
    // Sessão perdida (expirou, o servidor reiniciou ou foi encerrada): volta para o login.
    if (typeof window !== 'undefined') window.location.href = '/login'
  }
  return { ok: r.ok, status: r.status, data: (await r.json().catch(() => null)) as T | null }
}
