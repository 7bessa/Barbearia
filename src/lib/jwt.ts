// Compatível com o Edge Runtime (usado pelo middleware): só depende de "jose".
import { SignJWT, jwtVerify } from 'jose'

export type Role = 'cliente' | 'barbeiro' | 'admin'

const prod = process.env.NODE_ENV === 'production'
export const COOKIES = {
  at: 'bb_at', // access token (15 min)
  rt: 'bb_rt', // refresh token (7 dias), só enviado para /api/auth
  csrf: prod ? '__Host-bb_csrf' : 'bb_csrf',
}
export const ACCESS_TTL = 15 * 60
export const REFRESH_TTL = 7 * 24 * 60 * 60

function secret() {
  const s = process.env.JWT_SECRET
  if (!s || s.length < 32) throw new Error('JWT_SECRET ausente ou com menos de 32 caracteres')
  return new TextEncoder().encode(s)
}

export async function assinarAcesso(p: { sub: string; role: Role; sid: string }) {
  return new SignJWT({ role: p.role, sid: p.sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(p.sub)
    .setIssuer('barbearia')
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL}s`)
    .sign(secret())
}

export async function verificarAcesso(token: string) {
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ['HS256'], issuer: 'barbearia' })
    return { sub: String(payload.sub), role: payload.role as Role, sid: String(payload.sid) }
  } catch {
    return null
  }
}
