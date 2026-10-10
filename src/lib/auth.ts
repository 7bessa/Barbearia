// Sessão e autorização no servidor (Node runtime). NÃO importar no middleware (use jwt.ts).
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { COOKIES, ACCESS_TTL, REFRESH_TTL, assinarAcesso, verificarAcesso, type Role } from './jwt'
import { compararSeguro, sha256 } from './hash'
import { toUsuario, usuarioPorId, type Usuario } from './db'
import { prisma } from './prisma'
import { audit } from './audit'
import { contaBarbeiroAtiva } from './regras-agendamento'
import { acessoAssinaturaAtivo } from './assinatura'

const prod = process.env.NODE_ENV === 'production'

export const publico = (u: Usuario) => ({ id: u.id, nome: u.nome, email: u.email, role: u.role, barberId: u.barberId })

export function erro(status: number, msg: string, headers?: Record<string, string>) {
  return NextResponse.json({ erro: msg }, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
}

// Envolve o handler: detalhes do erro só no log do servidor; o cliente recebe "Erro interno".
export function seguro<C = unknown>(h: (req: NextRequest, ctx: C) => Promise<Response>) {
  return async (req: NextRequest, ctx: C) => {
    try {
      return await h(req, ctx)
    } catch (e) {
      console.error('[erro]', e instanceof Error ? e.message : 'desconhecido')
      return erro(500, 'Erro interno')
    }
  }
}

const opt = (maxAge: number, path = '/') => ({ httpOnly: true, secure: prod, sameSite: 'strict' as const, path, maxAge })

function lerRt(req: NextRequest) {
  const v = req.cookies.get(COOKIES.rt)?.value
  const i = v ? v.indexOf('.') : -1
  return v && i > 0 ? { sid: v.slice(0, i), token: v.slice(i + 1) } : null
}
export const lerRtSid = (req: NextRequest) => lerRt(req)?.sid

// Cria sessão NOVA (novo sid + novo refresh) e invalida a antiga: evita session fixation.
// Sessões ficam no PostgreSQL (tabela Sessao): valem para várias instâncias e sobrevivem a reinício.
export async function criarSessao(res: NextResponse, u: Usuario, sidAntigo?: string) {
  if (sidAntigo) await prisma.sessao.deleteMany({ where: { sid: sidAntigo } })
  if (Math.random() < 0.05) await prisma.sessao.deleteMany({ where: { exp: { lt: new Date() } } })
  const sid = randomBytes(32).toString('base64url')
  const refresh = randomBytes(32).toString('base64url')
  await prisma.sessao.create({ data: { sid, userId: u.id, refreshHash: sha256(refresh), exp: new Date(Date.now() + REFRESH_TTL * 1000) } })
  const at = await assinarAcesso({ sub: String(u.id), role: u.role, sid })
  res.cookies.set(COOKIES.at, at, opt(ACCESS_TTL))
  res.cookies.set(COOKIES.rt, `${sid}.${refresh}`, opt(REFRESH_TTL, '/api/auth'))
}

// Refresh com rotação. Se um refresh antigo for reutilizado (possível roubo), a sessão é destruída.
export async function renovarSessao(req: NextRequest, res: NextResponse) {
  const rt = lerRt(req)
  if (!rt) return null
  const s = await prisma.sessao.findUnique({ where: { sid: rt.sid } })
  if (!s || s.exp.getTime() < Date.now()) return null
  if (!compararSeguro(sha256(rt.token), s.refreshHash)) {
    await prisma.sessao.deleteMany({ where: { sid: rt.sid } })
    await audit(req, { acao: 'refresh_reutilizado', resultado: 'negado', userId: s.userId })
    return null
  }
  const u = await usuarioPorId(s.userId)
  if (!u) { await prisma.sessao.deleteMany({ where: { sid: rt.sid } }); return null }
  const barbeiro = u.role === 'barbeiro' && u.barberId
    ? await prisma.barbeiro.findFirst({ where: { id: u.barberId, barbeariaId: u.barbeariaId }, select: { ativo: true } })
    : null
  const barbearia = await prisma.barbearia.findUnique({ where: { id: u.barbeariaId }, select: { ativa: true } })
  if (!barbearia?.ativa || !contaBarbeiroAtiva(u.role, barbeiro?.ativo)) {
    await prisma.sessao.deleteMany({ where: { sid: rt.sid } })
    await audit(req, { acao: 'sessao_profissional_inativo', resultado: 'negado', userId: u.id })
    return null
  }
  // Troca atômica: só um refresh simultâneo consegue consumir esta sessão.
  const consumida = await prisma.sessao.deleteMany({ where: { sid: rt.sid, refreshHash: s.refreshHash } })
  if (consumida.count !== 1) return null
  await criarSessao(res, u)
  return u
}

export const destruirSessao = async (sid?: string) => { if (sid) await prisma.sessao.deleteMany({ where: { sid } }) }

export function limparCookies(res: NextResponse) {
  res.cookies.set(COOKIES.at, '', opt(0))
  res.cookies.set(COOKIES.rt, '', opt(0, '/api/auth'))
}

// Lê o usuário SEMPRE do cookie httpOnly + sessão no banco. O role vem do banco, não do token.
export async function lerSessao(req?: NextRequest) {
  const token = req ? req.cookies.get(COOKIES.at)?.value : (await cookies()).get(COOKIES.at)?.value
  if (!token) return null
  const p = await verificarAcesso(token)
  if (!p) return null
  const s = await prisma.sessao.findUnique({ where: { sid: p.sid }, include: { usuario: { include: { barbearia: { select: { ativa: true, assinaturaStatus: true, testeAte: true } }, barbeiro: { select: { ativo: true, barbeariaId: true } } } } } })
  if (!s || s.exp.getTime() < Date.now() || String(s.userId) !== p.sub) return null // logout invalida na hora, mesmo com JWT ainda válido
  const barbeiroNoTenant = s.usuario.role !== 'barbeiro' || s.usuario.barbeiro?.barbeariaId === s.usuario.barbeariaId
  if (!s.usuario.barbearia.ativa || !barbeiroNoTenant || !contaBarbeiroAtiva(s.usuario.role, s.usuario.barbeiro?.ativo)) {
    await prisma.sessao.deleteMany({ where: { sid: p.sid } })
    await audit(req ?? null, { acao: 'sessao_profissional_inativo', resultado: 'negado', userId: s.userId })
    return null
  }
  return {
    user: toUsuario(s.usuario),
    sid: p.sid,
    assinatura: { status: s.usuario.barbearia.assinaturaStatus, testeAte: s.usuario.barbearia.testeAte },
  }
}

// 3 tentativas de acesso indevido => sessão destruída.
export async function tentativaIndevida(sid: string, req: NextRequest | null, rota: string) {
  const s = await prisma.sessao.update({ where: { sid }, data: { indevidas: { increment: 1 } } }).catch(() => null)
  if (!s) return
  await audit(req, { acao: 'acesso_indevido', resultado: 'negado', userId: s.userId, detalhe: { rota, tentativas: s.indevidas } })
  if (s.indevidas >= 3) {
    await prisma.sessao.deleteMany({ where: { sid } })
    await audit(req, { acao: 'sessao_bloqueada', resultado: 'ok', userId: s.userId })
  }
}

// CSRF: Origin precisa bater + double submit cookie (cookie == header x-csrf-token).
export function verificarCsrf(req: NextRequest) {
  const esperado = process.env.APP_ORIGIN ?? req.nextUrl.origin
  if (req.headers.get('origin') !== esperado) return false
  const c = req.cookies.get(COOKIES.csrf)?.value
  const h = req.headers.get('x-csrf-token')
  return !!c && !!h && compararSeguro(c, h)
}

type Guarda = { ok: true; user: Usuario; sid: string } | { ok: false; res: NextResponse }

// Porta de entrada de toda rota protegida: CSRF (métodos que alteram dados) + sessão + role.
export async function exigir(req: NextRequest, roles?: Role[]): Promise<Guarda> {
  if (!['GET', 'HEAD'].includes(req.method) && !verificarCsrf(req)) {
    await audit(req, { acao: 'csrf_invalido', resultado: 'negado' })
    return { ok: false, res: erro(403, 'Requisição inválida') }
  }
  const s = await lerSessao(req)
  if (!s) return { ok: false, res: erro(401, 'Não autenticado') }
  const rotaDeAssinatura = req.nextUrl.pathname.startsWith('/api/admin/assinatura')
  const rotaDeSessao = req.nextUrl.pathname === '/api/auth/me'
  if (!rotaDeAssinatura && !rotaDeSessao && !acessoAssinaturaAtivo(s.assinatura.status, s.assinatura.testeAte)) {
    return { ok: false, res: NextResponse.json({ erro: 'O período de teste ou a assinatura terminou.', assinaturaExpirada: true }, { status: 402, headers: { 'Cache-Control': 'no-store', 'X-Subscription-Required': '1' } }) }
  }
  if (roles && !roles.includes(s.user.role)) {
    await tentativaIndevida(s.sid, req, req.nextUrl.pathname)
    return { ok: false, res: erro(403, 'Acesso negado') }
  }
  return { ok: true, user: s.user, sid: s.sid }
}

// Resposta JSON sem cache (dados pessoais/financeiros nunca devem ser guardados por proxies).
export const resp = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
