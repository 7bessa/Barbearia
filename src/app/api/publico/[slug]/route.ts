import { NextRequest } from 'next/server'
import { agendar } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { agendamentoPublicoSchema } from '@/lib/validation'
import { slugValido } from '@/lib/slug-barbearia'
import { consumir } from '@/lib/rateLimit'
import { audit, getIp } from '@/lib/audit'
import { erro, resp, seguro, verificarCsrf } from '@/lib/auth'
import { acessoAssinaturaAtivo } from '@/lib/assinatura'

type Contexto = { params: Promise<{ slug: string }> }
const COR_PADRAO = '#D4AF37'
const LOGO_PADRAO = '/logo.svg'
const corSegura = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v) ? v : COR_PADRAO
const logoSeguro = (v: string) => /^\/[A-Za-z0-9/_-]+\.(svg|png|webp|jpe?g)$/i.test(v) ? v : LOGO_PADRAO

async function buscarBarbearia(slug: string) {
  if (!slugValido(slug)) return null
  return prisma.barbearia.findUnique({ where: { slug } })
}

export const GET = seguro(async (_req: NextRequest, ctx: Contexto) => {
  const { slug } = await ctx.params
  const barbearia = await buscarBarbearia(slug)
  if (!barbearia?.ativa || !acessoAssinaturaAtivo(barbearia.assinaturaStatus, barbearia.testeAte)) return erro(404, 'Barbearia não encontrada')
  const [barbeiros, servicos] = await Promise.all([
    prisma.barbeiro.findMany({ where: { barbeariaId: barbearia.id, ativo: true }, orderBy: { id: 'asc' }, select: { id: true, nome: true, foto: true } }),
    prisma.servico.findMany({ where: { barbeariaId: barbearia.id, ativo: true }, orderBy: { id: 'asc' }, select: { id: true, nome: true, precoCent: true, dur: true } }),
  ])
  return resp({
    barbearia: { id: barbearia.id, nome: barbearia.nome, slug: barbearia.slug, slogan: barbearia.slogan, logo: logoSeguro(barbearia.logo), corPrimaria: corSegura(barbearia.corPrimaria), corFundo: corSegura(barbearia.corFundo) },
    barbeiros,
    servicos: servicos.map((s) => ({ id: s.id, nome: s.nome, preco: s.precoCent / 100, dur: s.dur })),
  })
})

export const POST = seguro(async (req: NextRequest, ctx: Contexto) => {
  const { slug } = await ctx.params
  if (!verificarCsrf(req)) return erro(403, 'Requisição inválida')
  const barbearia = await buscarBarbearia(slug)
  if (!barbearia?.ativa || !acessoAssinaturaAtivo(barbearia.assinaturaStatus, barbearia.testeAte)) return erro(404, 'Barbearia não encontrada')
  if (!(await consumir(`publico-agendar:${barbearia.id}:${getIp(req)}`, 8, 60 * 60 * 1000))) {
    return erro(429, 'Muitas tentativas. Tente novamente mais tarde.')
  }
  const p = agendamentoPublicoSchema.safeParse(await req.json().catch(() => null))
  if (!p.success) return erro(400, 'Confira seus dados e aceite os termos para continuar.')
  const { servicoId, barberId, data, hora, nome, telefone } = p.data
  const [servico, barbeiro] = await Promise.all([
    prisma.servico.findFirst({ where: { id: servicoId, barbeariaId: barbearia.id, ativo: true } }),
    prisma.barbeiro.findFirst({ where: { id: barberId, barbeariaId: barbearia.id, ativo: true } }),
  ])
  if (!servico || !barbeiro) return erro(400, 'Serviço ou profissional indisponível.')
  const resultado = await agendar(
    barbearia.id,
    { nome, telefone, publico: true },
    { id: servico.id, dur: servico.dur, preco: servico.precoCent / 100 },
    barbeiro.id,
    data,
    hora,
    false,
  )
  if (!resultado.ok) return erro(409, 'Esse horário acabou de ficar indisponível. Escolha outro.')
  await audit(req, { acao: 'agendamento_publico_criado', resultado: 'ok', barbeariaId: barbearia.id, detalhe: { id: resultado.a.id } })
  const agendamento = resultado.a
  return resp({ agendamento: { id: agendamento.id, data: agendamento.data, hora: agendamento.hora, preco: agendamento.preco } }, 201)
})

export const dynamic = 'force-dynamic'
