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
  const r = await exigir(req, ['barbeiro', 'recepcionista', 'admin'])
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
      select: { id: true, nome: true, telefone: true, email: true, semConta: true },
    }),
  ])

  const ids = rows.map((cliente) => cliente.id)
  const atendimentos = ids.length ? await prisma.agendamento.groupBy({
    by: ['clienteId', 'status'],
    where: {
      barbeariaId: user.barbeariaId,
      clienteId: { in: ids },
      ...(admin ? {} : { barberId: user.barberId ?? -1 }),
    },
    _count: { _all: true },
    _max: { data: true },
    _sum: { precoCent: true },
  }) : []
  const resumoPorCliente = new Map<number, { visitas: number; faltas: number; ultimoAtendimento: string | null; totalGastoCent: number }>()
  for (const grupo of atendimentos) {
    if (grupo.clienteId === null) continue
    const resumo = resumoPorCliente.get(grupo.clienteId) ?? { visitas: 0, faltas: 0, ultimoAtendimento: null, totalGastoCent: 0 }
    if (grupo.status === 'concluido') {
      resumo.visitas += grupo._count._all
      resumo.totalGastoCent += grupo._sum.precoCent ?? 0
      if (grupo._max.data && (!resumo.ultimoAtendimento || grupo._max.data > resumo.ultimoAtendimento)) resumo.ultimoAtendimento = grupo._max.data
    }
    if (grupo.status === 'faltou') resumo.faltas += grupo._count._all
    resumoPorCliente.set(grupo.clienteId, resumo)
  }

  const itens = rows.map((u) => {
    const resumo = resumoPorCliente.get(u.id) ?? { visitas: 0, faltas: 0, ultimoAtendimento: null, totalGastoCent: 0 }
    return {
      id: u.id, nome: u.nome, telefone: u.telefone, semConta: u.semConta,
      visitas: resumo.visitas,
      faltas: resumo.faltas,
      ultimoAtendimento: resumo.ultimoAtendimento,
      ...(admin ? { email: u.email ?? '', totalGasto: resumo.totalGastoCent / 100 } : {}),
    }
  })
  return resp({ clientes: itens, total, pagina, tamanho: TAM })
})

// Cadastro de cliente no balcão (sem login). O cliente deve concordar com o uso dos dados.
export const POST = seguro(async (req: NextRequest) => {
  const r = await exigir(req, ['barbeiro', 'recepcionista', 'admin'])
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
