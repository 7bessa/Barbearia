import { NextRequest, NextResponse } from 'next/server'
import { BARBEARIA } from '@/config/barbearia'
import { prisma } from '@/lib/prisma'
import { conflito } from '@/lib/db'
import { onboardingSchema } from '@/lib/validation'
import { hashSenha } from '@/lib/hash'
import { consumir } from '@/lib/rateLimit'
import { audit, getIp } from '@/lib/audit'
import { erro, seguro, verificarCsrf } from '@/lib/auth'
import { onboardingPublicoAtivo } from '@/lib/onboarding'
import { emailPodeEnviar, emitirTokenConta, enviarLinkConta } from '@/lib/account-tokens'

export const POST = seguro(async (req: NextRequest) => {
  if (!onboardingPublicoAtivo()) return erro(503, 'O cadastro de novas barbearias ainda não está disponível.')
  if (!verificarCsrf(req)) return erro(403, 'Requisição inválida')
  if (!emailPodeEnviar()) return erro(503, 'A abertura de novas barbearias está temporariamente indisponível.')
  if (!(await consumir(`onboarding:${getIp(req)}`, 3, 24 * 60 * 60 * 1000))) {
    return erro(429, 'Muitas tentativas. Tente novamente amanhã.')
  }

  const p = onboardingSchema.safeParse(await req.json().catch(() => null))
  if (!p.success) return erro(400, 'Confira os dados, o endereço público e aceite os termos.')
  const d = p.data

  const [slugExistente, emailExistente] = await Promise.all([
    prisma.barbearia.findUnique({ where: { slug: d.slug }, select: { id: true } }),
    prisma.usuario.findUnique({ where: { email: d.email }, select: { id: true } }),
  ])
  if (slugExistente || emailExistente) return erro(409, 'Não foi possível abrir a barbearia online. Confira o endereço e o e-mail informados.')

  const senhaHash = await hashSenha(d.senha)
  try {
    const criado = await prisma.$transaction(async (tx) => {
      const barbearia = await tx.barbearia.create({
        data: {
          nome: d.nomeBarbearia,
          slogan: d.slogan,
          slug: d.slug,
          corPrimaria: d.corPrimaria,
          corFundo: d.corFundo,
          assinaturaStatus: 'teste',
          testeAte: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      })
      const usuario = await tx.usuario.create({
        data: {
          barbeariaId: barbearia.id,
          nome: d.nome,
          email: d.email,
          telefone: d.telefone,
          senhaHash,
          role: 'admin',
          emailVerificado: false,
        },
      })
      await tx.horario.create({
        data: { id: barbearia.id, barbeariaId: barbearia.id, ...BARBEARIA.horario, dias: [...BARBEARIA.horario.dias] },
      })
      await tx.servico.createMany({
        data: [
          { barbeariaId: barbearia.id, nome: 'Corte', precoCent: 4000, dur: 30 },
          { barbeariaId: barbearia.id, nome: 'Corte + Barba', precoCent: 6000, dur: 45 },
          { barbeariaId: barbearia.id, nome: 'Barba', precoCent: 3000, dur: 20 },
        ],
      })
      return { barbearia, usuario }
    })

    const token = await emitirTokenConta(criado.usuario.id, 'verificacao')
    let linkLocal: string | undefined
    try {
      linkLocal = await enviarLinkConta(d.email, d.nome, 'verificacao', token)
    } catch {
      await audit(req, { acao: 'barbearia_criada', resultado: 'falha', userId: criado.usuario.id, barbeariaId: criado.barbearia.id, detalhe: { confirmacaoEnviada: false } })
      return erro(503, 'A barbearia foi criada, mas o e-mail falhou. Use “Reenviar confirmação” na tela de acesso.')
    }
    await audit(req, { acao: 'barbearia_criada', resultado: 'ok', userId: criado.usuario.id, barbeariaId: criado.barbearia.id, detalhe: { confirmacaoEnviada: true } })
    return NextResponse.json({ confirmacaoNecessaria: true, email: d.email, linkLocal }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    if (conflito(e)) return erro(409, 'Não foi possível abrir a barbearia online. Confira o endereço e o e-mail informados.')
    throw e
  }
})

export const dynamic = 'force-dynamic'
