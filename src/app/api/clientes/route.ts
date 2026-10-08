import { NextRequest } from 'next/server'
import type { Prisma } from '@prisma/client'
import { clienteNovoSchema } from '@/lib/validation'
import { conflito, criarUsuario, filtroClientes, usuarioPorEmail, usuarioPorTelefone } from '@/lib/db'
import { prisma } from '@/lib/prisma'
import { limparTexto, somenteDigitos } from '@/lib/sanitize'
import { consumir } from '@/lib/rateLimit'
import { audit } from '@/lib/audit'
import { erro, exigir, resp, seguro } from '@/lib/auth'

const TAM = 50

// Lista de clientes com busca (?q=nome ou telefone) e paginação (?pagina=1).
// Barbeiro vê só os seus; dono vê todos e também e-mail e total gasto.
export const GET = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['barbeiro', 'admin'])
  if (!r.ok) return r.res
  const { user } = r
  const admin = user.role === 'admin'
  const q = limparTexto(req.nextUrl.searchParams.get('q') ?? '', 60)
  const qd = somenteDigitos(q)
  const pagina = Math.max(1, Math.min(1000, parseInt(req.nextUrl.searchParams.get('pagina') ?? '1', 10) || 1))

  const where: Prisma.UsuarioWhereInput = { ...filtroClientes(user) }
  if (q) {
    where.AND = [{ OR: [{ nome: { contains: q, mode: 'insensitive' } }, ...(qd.length >= 4 ? [{ telefone: { contains: qd } }] : [])] }]
  }
  const [total, rows] = await Promise.all([
    prisma.usuario.count({ where }),
    prisma.usuario.findMany({
      where, orderBy: { nome: 'asc' }, skip: (pagina - 1) * TAM, take: TAM,
      include: { agendamentos: { where: { barbeariaId: user.barbeariaId, ...(admin ? {} : { barberId: user.barberId ?? -1 }) }, select: { status: true, data: true, precoCent: true } } },
    }),
  ])

  const itens = rows.map((u) => {
    const feitos = u.agendamentos.filter((a) => a.status === 'concluido')
    return {
      id: u.id, nome: u.nome, telefone: u.telefone, semConta: u.semConta,
      visitas: feitos.length,
      faltas: u.agendamentos.filter((a) => a.status === 'faltou').length,
      ultimoAtendimento: feitos.reduce((m, a) => (a.data > m ? a.data : m), '') || null,
      ...(admin ? { email: u.email ?? '', totalGasto: feitos.reduce((s, a) => s + a.precoCent, 0) / 100 } : {}),
    }
  })
  return resp({ clientes: itens, total, pagina, tamanho: TAM })
})

// Cadastro de cliente no balcão (sem login). O cliente deve concordar com o uso dos dados.
export const POST = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['barbeiro', 'admin'])
  if (!r.ok) return r.res
  if (!(await consumir(`cliente:${r.user.id}`, 60, 60 * 60 * 1000))) return erro(429, 'Muitas requisições. Tente mais tarde.')
  const p = clienteNovoSchema.safeParse(await req.json().catch(() => null))
  if (!p.success) return erro(400, 'Dados inválidos')
  const { nome, telefone, email } = p.data
  if (email && (await usuarioPorEmail(email))) return erro(409, 'Não foi possível concluir o cadastro. Verifique os dados.')
  if (await usuarioPorTelefone(telefone, r.user.barbeariaId)) return erro(409, 'Já existe cliente com este telefone')
  try {
    const u = await criarUsuario({ nome, telefone, email: email ?? '', role: 'cliente', senhaHash: '', barbeariaId: r.user.barbeariaId, semConta: true, criadoPor: r.user.id })
    await audit(req, { acao: 'cliente_cadastrado', resultado: 'ok', userId: r.user.id, detalhe: { id: u.id } })
    return resp({ cliente: { id: u.id, nome: u.nome, telefone: u.telefone, semConta: true } }, 201)
  } catch (e) {
    if (conflito(e)) return erro(409, 'Já existe cliente com este telefone')
    throw e
  }
})
