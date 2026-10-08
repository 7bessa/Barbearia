// Acesso a dados (PostgreSQL via Prisma). Mantém os mesmos formatos de antes: preço em reais, ids numéricos.
import { randomBytes } from 'crypto'
import { Prisma } from '@prisma/client'
import type {
  Usuario as PUsuario, Agendamento as PAg, Barbeiro as PBarb, Servico as PServ, Bloqueio as PBloq, Nota as PNota,
} from '@prisma/client'
import { prisma } from './prisma'
import { sha256 } from './hash'
import type { Role } from './jwt'
import { BARBEARIA } from '@/config/barbearia'
import { filtroClientesTenant } from './tenant-scope'
import { agoraBR, horariosLivresDe, regraHorario, type Contexto, type Horario } from './horarios'

export * from './horarios'
export type Cx = Prisma.TransactionClient
export const BARBEARIA_PADRAO_ID = 1

export type Forma = 'dinheiro' | 'pix' | 'debito' | 'credito'
export type Status = 'agendado' | 'concluido' | 'faltou' | 'cancelado'
export type Usuario = {
  id: number; barbeariaId: number; nome: string; email: string; telefone: string
  role: Role; barberId?: number; senhaHash: string
  semConta?: boolean // cliente cadastrado no balcão (não faz login)
  criadoPor?: number
}
export type Barbeiro = { id: number; nome: string; foto: string; ativo: boolean; comissao: number }
export type Servico = { id: number; nome: string; preco: number; dur: number; ativo: boolean }
export type Bloqueio = { id: number; barberId: number; data: string; ini: string; fim: string; motivo: string }
export type Nota = { id: number; clienteId: number; autorId: number; autorNome: string; texto: string; criadaEm: string }
export type Agendamento = {
  id: number; clienteId: number; clienteNome: string; clienteTel: string
  barberId: number; servicoId: number; data: string; hora: string
  dur: number; preco: number; cadeira: number; status: Status; criadoEm: string
  forma?: Forma; comissaoPct?: number; pagoEm?: string // preenchidos ao concluir (snapshot da comissão)
}

// ---------- conversões linha do banco -> formato da API ----------
export const toUsuario = (u: PUsuario): Usuario => ({
  id: u.id, barbeariaId: u.barbeariaId, nome: u.nome, email: u.email ?? '', telefone: u.telefone, role: u.role, senhaHash: u.senhaHash,
  barberId: u.barberId ?? undefined, semConta: u.semConta || undefined, criadoPor: u.criadoPorId ?? undefined,
})
export const toBarb = (b: PBarb): Barbeiro => ({ id: b.id, nome: b.nome, foto: b.foto, ativo: b.ativo, comissao: b.comissao })
export const toServ = (s: PServ): Servico => ({ id: s.id, nome: s.nome, preco: s.precoCent / 100, dur: s.dur, ativo: s.ativo })
export const toBloq = (k: PBloq): Bloqueio => ({ id: k.id, barberId: k.barberId, data: k.data, ini: k.ini, fim: k.fim, motivo: k.motivo })
export const toNota = (n: PNota): Nota => ({
  id: n.id, clienteId: n.clienteId, autorId: n.autorId ?? 0, autorNome: n.autorNome, texto: n.texto, criadaEm: n.criadaEm.toISOString(),
})
export const toAg = (a: PAg): Agendamento => ({
  id: a.id, clienteId: a.clienteId ?? 0, clienteNome: a.clienteNome, clienteTel: a.clienteTel,
  barberId: a.barberId, servicoId: a.servicoId, data: a.data, hora: a.hora, dur: a.dur, preco: a.precoCent / 100, cadeira: a.cadeira,
  status: a.status, criadoEm: a.criadoEm.toISOString(),
  forma: a.forma ?? undefined, comissaoPct: a.comissaoPct ?? undefined, pagoEm: a.pagoEm?.toISOString(),
})
export const centavos = (reais: number) => Math.round(reais * 100)

export const conflito = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' // violação de unicidade
export const naoEncontrado = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2025'

// ---------- consultas ----------
export const usuarioPorEmail = async (e: string) => { const u = await prisma.usuario.findUnique({ where: { email: e } }); return u ? toUsuario(u) : undefined }
export const usuarioPorId = async (id: number, barbeariaId?: number) => {
  const u = barbeariaId === undefined
    ? await prisma.usuario.findUnique({ where: { id } })
    : await prisma.usuario.findFirst({ where: { id, barbeariaId } })
  return u ? toUsuario(u) : undefined
}
export const usuarioPorTelefone = async (t: string, barbeariaId: number) => {
  const u = await prisma.usuario.findUnique({ where: { barbeariaId_telefone: { barbeariaId, telefone: t } } })
  return u ? toUsuario(u) : undefined
}
export const agendamentoPorId = async (id: number, barbeariaId: number) => {
  const a = await prisma.agendamento.findFirst({ where: { id, barbeariaId } })
  return a ? toAg(a) : undefined
}

export async function carregarNomes(barbeariaId: number) {
  const [b, s] = await Promise.all([
    prisma.barbeiro.findMany({ where: { barbeariaId }, select: { id: true, nome: true } }),
    prisma.servico.findMany({ where: { barbeariaId }, select: { id: true, nome: true } }),
  ])
  return { barb: new Map(b.map((x) => [x.id, x.nome])), serv: new Map(s.map((x) => [x.id, x.nome])) }
}
export type Nomes = Awaited<ReturnType<typeof carregarNomes>>

// ---------- horários ----------
export async function getHorario(barbeariaId = 1, cx: Cx = prisma): Promise<Horario> {
  let h = await cx.horario.findUnique({ where: { barbeariaId } })
  if (!h) h = await cx.horario.create({ data: { id: barbeariaId, barbeariaId, ...BARBEARIA.horario, dias: [...BARBEARIA.horario.dias] } })
  return { abre: h.abre, fecha: h.fecha, almocoIni: h.almocoIni, almocoFim: h.almocoFim, dias: h.dias }
}
export async function salvarHorario(barbeariaId: number, h: Horario) {
  await prisma.horario.upsert({ where: { barbeariaId }, update: h, create: { id: barbeariaId, barbeariaId, ...h } })
  return getHorario(barbeariaId)
}

async function contexto(barbeariaId: number, barberId: number, data: string, cx: Cx): Promise<Contexto> {
  const [horario, bloqueios, ocupados] = await Promise.all([
    getHorario(barbeariaId, cx),
    cx.bloqueio.findMany({ where: { barbeariaId, barberId, data }, select: { ini: true, fim: true } }),
    cx.agendamento.findMany({ where: { barbeariaId, barberId, data, status: { not: 'cancelado' } }, select: { hora: true, dur: true } }),
  ])
  return { horario, bloqueios, ocupados }
}
export async function horarioValido(barbeariaId: number, barberId: number, data: string, hora: string, dur: number, staff = false, cx: Cx = prisma) {
  return regraHorario(await contexto(barbeariaId, barberId, data, cx), data, hora, dur, staff)
}
export async function horariosLivres(barbeariaId: number, barberId: number, data: string, dur: number, staff = false) {
  const [ctx, barbearia, marcados] = await Promise.all([
    contexto(barbeariaId, barberId, data, prisma),
    prisma.barbearia.findUniqueOrThrow({ where: { id: barbeariaId }, select: { capacidadeCadeiras: true } }),
    prisma.agendamento.findMany({ where: { barbeariaId, data, status: 'agendado' }, select: { hora: true, dur: true, cadeira: true } }),
  ])
  return horariosLivresDe(ctx, data, dur, staff).filter((hora) => cadeiraLivre(marcados, hora, dur, barbearia.capacidadeCadeiras) !== null)
}

type OcupacaoCadeira = { hora: string; dur: number; cadeira: number }
const cadeiraLivre = (marcados: OcupacaoCadeira[], hora: string, dur: number, capacidade: number) => {
  const inicio = Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3))
  for (let cadeira = 1; cadeira <= capacidade; cadeira++) {
    const ocupada = marcados.some((a) => a.cadeira === cadeira && inicio < Number(a.hora.slice(0, 2)) * 60 + Number(a.hora.slice(3)) + a.dur && inicio + dur > Number(a.hora.slice(0, 2)) * 60 + Number(a.hora.slice(3)))
    if (!ocupada) return cadeira
  }
  return null
}

// Checa o horário e grava dentro de uma transação com trava por barbeiro: dois pedidos simultâneos
// para o mesmo horário não passam juntos (o índice único parcial é a segunda barreira).
export async function agendar(
  barbeariaId: number,
  alvo: { id?: number; nome: string; telefone: string; publico?: boolean },
  sv: { id: number; dur: number; preco: number },
  barberId: number, data: string, hora: string, staff: boolean
): Promise<{ ok: true; a: Agendamento } | { ok: false; motivo: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${barbeariaId}::bigint)`
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${barberId}::bigint)`
      const motivo = await horarioValido(barbeariaId, barberId, data, hora, sv.dur, staff, tx)
      if (motivo) return { ok: false as const, motivo }
      const [barbearia, marcados] = await Promise.all([
        tx.barbearia.findUniqueOrThrow({ where: { id: barbeariaId }, select: { capacidadeCadeiras: true } }),
        tx.agendamento.findMany({ where: { barbeariaId, data, status: 'agendado' }, select: { hora: true, dur: true, cadeira: true } }),
      ])
      const cadeira = cadeiraLivre(marcados, hora, sv.dur, barbearia.capacidadeCadeiras)
      if (cadeira === null) return { ok: false as const, motivo: 'cadeira_ocupada' }
      let clienteId = alvo.id ?? null
      if (!clienteId && alvo.publico) {
        let cliente = await tx.usuario.findUnique({ where: { barbeariaId_telefone: { barbeariaId, telefone: alvo.telefone } } })
        if (!cliente) {
          await tx.usuario.createMany({
            data: [{ barbeariaId, nome: alvo.nome, email: null, telefone: alvo.telefone, role: 'cliente', senhaHash: '', semConta: true }],
            skipDuplicates: true,
          })
          cliente = await tx.usuario.findUnique({ where: { barbeariaId_telefone: { barbeariaId, telefone: alvo.telefone } } })
        }
        if (cliente?.role === 'cliente') clienteId = cliente.id
      }
      const row = await tx.agendamento.create({
        data: { barbeariaId, clienteId, clienteNome: alvo.nome, clienteTel: alvo.telefone, barberId, servicoId: sv.id, data, hora, dur: sv.dur, precoCent: centavos(sv.preco), cadeira },
      })
      return { ok: true as const, a: toAg(row) }
    })
  } catch (e) {
    if (conflito(e)) return { ok: false, motivo: 'ocupado' }
    throw e
  }
}

// ---------- usuários ----------
type NovoUsuario = { nome: string; email: string; telefone: string; role: Role; senhaHash: string; barbeariaId: number; semConta?: boolean; criadoPor?: number }
export async function criarUsuario(d: NovoUsuario, cx: Cx = prisma) {
  const barbeariaId = d.barbeariaId
  const barberId = d.role === 'barbeiro'
    ? (await cx.barbeiro.create({ data: { barbeariaId, nome: d.nome, comissao: BARBEARIA.comissaoPadrao } })).id
    : undefined
  const u = await cx.usuario.create({
    data: { barbeariaId, nome: d.nome, email: d.email || null, telefone: d.telefone, role: d.role, senhaHash: d.senhaHash, semConta: d.semConta ?? false, criadoPorId: d.criadoPor, barberId },
  })
  return toUsuario(u)
}

export class ConviteInvalido extends Error {}
// Cadastro público: para barbeiro, cria o usuário e consome o convite NA MESMA transação (ou nada é gravado).
export function cadastrar(d: NovoUsuario, codigoConvite?: string) {
  return prisma.$transaction(async (tx) => {
    const tenantDoCadastro = d.role === 'barbeiro'
      ? (await tx.convite.findFirst({
          where: { hash: sha256((codigoConvite ?? '').trim()), usadoPorId: null, expira: { gt: new Date() } },
          select: { barbeariaId: true },
        }))?.barbeariaId
      : d.barbeariaId
    if (!tenantDoCadastro) throw new ConviteInvalido()
    const barbeariaId = tenantDoCadastro
    const u = await criarUsuario({ ...d, barbeariaId }, tx)
    if (d.role === 'barbeiro' && !(await usarConvite(codigoConvite ?? '', u.id, barbeariaId, tx))) throw new ConviteInvalido()
    return u
  })
}

// Barbeiro só enxerga clientes que atendeu/agendou ou que ele mesmo cadastrou; dono vê todos.
export function filtroClientes(u: Usuario): Prisma.UsuarioWhereInput {
  return filtroClientesTenant(u)
}
export async function equipeAcessaCliente(u: Usuario, clienteId: number) {
  if (u.role === 'admin' || u.role === 'recepcionista') return true
  if (u.role !== 'barbeiro') return false
  return (await prisma.usuario.count({ where: { id: clienteId, ...filtroClientes(u) } })) > 0
}

// LGPD: apaga dados pessoais. Financeiro já realizado é mantido ANONIMIZADO (obrigação fiscal).
export async function removerUsuario(id: number, barbeariaId: number) {
  await prisma.$transaction(async (tx) => {
    const u = await tx.usuario.findFirst({ where: { id, barbeariaId } })
    if (!u) return
    if (u.role === 'cliente') {
      await tx.agendamento.deleteMany({ where: { barbeariaId, clienteId: id, status: { in: ['agendado', 'cancelado'] } } })
      await tx.agendamento.updateMany({ where: { barbeariaId, clienteId: id }, data: { clienteId: null, clienteNome: 'Cliente removido', clienteTel: '' } })
    }
    if (u.role === 'barbeiro' && u.barberId) {
      await tx.barbeiro.update({ where: { id: u.barberId, barbeariaId }, data: { ativo: false } })
      const [hoje, hora] = agoraBR().split(' ')
      await tx.agendamento.updateMany({
        where: { barbeariaId, barberId: u.barberId, status: 'agendado', OR: [{ data: { gt: hoje } }, { data: hoje, hora: { gt: hora } }] },
        data: { status: 'cancelado' },
      })
    }
    await tx.nota.updateMany({ where: { barbeariaId, autorId: id }, data: { autorNome: 'Profissional removido' } })
    await tx.usuario.deleteMany({ where: { id, barbeariaId } }) // sessões e notas sobre o cliente saem em cascata
  })
}

// ---------- convites de barbeiro: aleatório, uso único, com validade; só o hash fica guardado ----------
export async function criarConvite(adminId: number, barbeariaId: number) {
  await prisma.convite.deleteMany({ where: { barbeariaId, OR: [{ expira: { lt: new Date() } }, { usadoPorId: { not: null } }] } })
  const codigo = randomBytes(9).toString('base64url')
  const expira = new Date(Date.now() + BARBEARIA.conviteHoras * 3600 * 1000)
  await prisma.convite.create({ data: { hash: sha256(codigo), barbeariaId, criadoPorId: adminId, expira } })
  return { codigo, expira: expira.toISOString() }
}
export const conviteValido = async (codigo: string) =>
  (await prisma.convite.count({ where: { hash: sha256(codigo.trim()), usadoPorId: null, expira: { gt: new Date() } } })) > 0
export const barbeariaDoConvite = async (codigo: string) =>
  (await prisma.convite.findFirst({
    where: { hash: sha256(codigo.trim()), usadoPorId: null, expira: { gt: new Date() } },
    select: { barbeariaId: true },
  }))?.barbeariaId
// Atômico: dois cadastros com o mesmo código nunca passam juntos.
export async function usarConvite(codigo: string, userId: number, barbeariaId: number, cx: Cx = prisma) {
  const r = await cx.convite.updateMany({
    where: { hash: sha256(codigo.trim()), barbeariaId, usadoPorId: null, expira: { gt: new Date() } },
    data: { usadoPorId: userId },
  })
  return r.count === 1
}

// Só os campos necessários. Dados do cliente e forma de pagamento apenas para barbeiro/admin.
export const dto = (a: Agendamento, equipe: boolean) => ({
  id: a.id, data: a.data, hora: a.hora, servicoId: a.servicoId, barberId: a.barberId,
  dur: a.dur, preco: a.preco, status: a.status,
  ...(equipe ? { clienteId: a.clienteId, clienteNome: a.clienteNome, clienteTel: a.clienteTel, forma: a.forma ?? null } : {}),
})
