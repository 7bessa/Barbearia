import { NextRequest, NextResponse } from 'next/server'
import { loginSchema } from '@/lib/validation'
import { usuarioPorEmail } from '@/lib/db'
import { verificarSenha, sha256 } from '@/lib/hash'
import { bloqueado, registrarFalha, limpar } from '@/lib/rateLimit'
import { audit, getIp } from '@/lib/audit'
import { criarSessao, erro, lerRtSid, publico, seguro, verificarCsrf } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { contaBarbeiroAtiva } from '@/lib/regras-agendamento'

export const POST = seguro(async (req: NextRequest) => {
  if (!verificarCsrf(req)) return erro(403, 'Requisição inválida')
  const p = loginSchema.safeParse(await req.json().catch(() => null))
  if (!p.success) return erro(400, 'Dados inválidos')

  const { email, senha } = p.data
  const kIp = `login:ip:${getIp(req)}`
  const kEmail = `login:email:${sha256(email)}` // conta falhas mesmo se o e-mail não existir
  const espera = Math.max(await bloqueado(kIp), await bloqueado(kEmail))
  if (espera) {
    await audit(req, { acao: 'login', resultado: 'negado', detalhe: { motivo: 'rate_limit' } })
    return erro(429, 'Muitas tentativas. Tente novamente em alguns minutos.', { 'Retry-After': String(espera) })
  }

  const achado = await usuarioPorEmail(email)
  const barbeiro = achado?.role === 'barbeiro' && achado.barberId
    ? await prisma.barbeiro.findFirst({ where: { id: achado.barberId, barbeariaId: achado.barbeariaId }, select: { ativo: true } })
    : null
  const barbearia = achado
    ? await prisma.barbearia.findUnique({ where: { id: achado.barbeariaId }, select: { ativa: true } })
    : null
  const u = achado && barbearia?.ativa && !achado.semConta && contaBarbeiroAtiva(achado.role, barbeiro?.ativo) ? achado : undefined
  const ok = await verificarSenha(senha, u?.senhaHash) // gasta o mesmo tempo com ou sem usuário
  if (!u || !ok) {
    await registrarFalha(kIp)
    await registrarFalha(kEmail)
    await audit(req, { acao: 'login', resultado: 'falha', detalhe: { emailHash: sha256(email).slice(0, 12) } })
    return erro(401, 'Email ou senha inválidos')
  }

  await limpar(kEmail)
  const res = NextResponse.json({ usuario: publico(u) }, { headers: { 'Cache-Control': 'no-store' } })
  await criarSessao(res, u, lerRtSid(req))
  await audit(req, { acao: 'login', resultado: 'ok', userId: u.id })
  return res
})
