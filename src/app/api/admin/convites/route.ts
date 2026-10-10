import { NextRequest } from 'next/server'
import { criarConvite, type PapelConvite } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { consumir } from '@/lib/rateLimit'
import { audit } from '@/lib/audit'
import { erro, exigir, resp, seguro } from '@/lib/auth'
import { limiteDoPlano } from '@/lib/planos'

// Dono gera um código de convite (uso único, validade em BARBEARIA.conviteHoras) para a equipe.
export const POST = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  if (!(await consumir(`convite:${r.user.id}`, 20, 60 * 60 * 1000))) return erro(429, 'Muitas requisições. Tente mais tarde.')
  const dados = await req.json().catch(() => ({}))
  const papel: PapelConvite = dados?.role === 'recepcionista' ? 'recepcionista' : 'barbeiro'
  if (dados?.role !== undefined && !['barbeiro', 'recepcionista'].includes(dados.role)) return erro(400, 'Tipo de acesso inválido.')
  if (papel === 'barbeiro') {
    const [barbearia, ativos] = await Promise.all([
      prisma.barbearia.findUnique({ where: { id: r.user.barbeariaId }, select: { plano: true } }),
      prisma.barbeiro.count({ where: { barbeariaId: r.user.barbeariaId, ativo: true } }),
    ])
    if (!barbearia) return erro(404, 'Barbearia não encontrada')
    const limite = limiteDoPlano(barbearia.plano).profissionais
    if (ativos >= limite) return erro(403, `O plano atual já atingiu o limite de ${limite} profissional(is) ativo(s).`)
  }
  const c = await criarConvite(r.user.id, r.user.barbeariaId, papel)
  await audit(req, { acao: 'convite_criado', resultado: 'ok', userId: r.user.id, detalhe: { papel } })
  return resp(c, 201) // o código só aparece agora; no servidor fica apenas o hash
})

export const GET = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  return resp({ pendentes: await prisma.convite.count({ where: { barbeariaId: r.user.barbeariaId, usadoPorId: null, expira: { gt: new Date() } } }) })
})
