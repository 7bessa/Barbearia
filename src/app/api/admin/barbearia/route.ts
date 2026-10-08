import { NextRequest } from 'next/server'
import { barbeariaConfigSchema } from '@/lib/validation'
import { prisma } from '@/lib/prisma'
import { conflito } from '@/lib/db'
import { audit } from '@/lib/audit'
import { erro, exigir, resp, seguro } from '@/lib/auth'

export const GET = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  const barbearia = await prisma.barbearia.findUnique({
    where: { id: r.user.barbeariaId },
    select: { id: true, nome: true, slogan: true, slug: true, corPrimaria: true, corFundo: true, imagemAmbiente: true, capacidadeCadeiras: true },
  })
  if (!barbearia) return erro(404, 'Barbearia não encontrada')
  return resp({ barbearia })
})

export const PUT = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['admin'])
  if (!r.ok) return r.res
  const p = barbeariaConfigSchema.safeParse(await req.json().catch(() => null))
  if (!p.success) return erro(400, 'Confira o nome, endereço e cores da página.')

  const slugEmUso = await prisma.barbearia.findFirst({
    where: { slug: p.data.slug, id: { not: r.user.barbeariaId } },
    select: { id: true },
  })
  if (slugEmUso) return erro(409, 'Este endereço já está sendo usado por outra barbearia.')

  try {
    const barbearia = await prisma.barbearia.update({
      where: { id: r.user.barbeariaId },
      data: p.data,
      select: { id: true, nome: true, slogan: true, slug: true, corPrimaria: true, corFundo: true, imagemAmbiente: true, capacidadeCadeiras: true },
    })
    await audit(req, { acao: 'marca_barbearia_alterada', resultado: 'ok', userId: r.user.id })
    return resp({ barbearia })
  } catch (e) {
    if (conflito(e)) return erro(409, 'Este endereço já está sendo usado por outra barbearia.')
    throw e
  }
})

export const dynamic = 'force-dynamic'
