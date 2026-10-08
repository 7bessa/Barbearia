import { z } from 'zod'
import { limparTexto, somenteDigitos } from './sanitize'
import { slugValido } from './slug-barbearia'

const email = z
  .string()
  .max(254)
  .transform((s) => s.trim().toLowerCase())
  .refine((s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s))

const nome = z
  .string()
  .max(200)
  .transform((s) => limparTexto(s, 80))
  .refine((s) => s.split(' ').filter((p) => p.length > 1).length >= 2) // nome + sobrenome
  .refine((s) => /^[A-Za-zÀ-ÖØ-öø-ÿ' .-]+$/.test(s))

// Telefone brasileiro: DDD + celular (9 dígitos começando com 9) ou fixo (8 dígitos).
const telefone = z
  .string()
  .max(30)
  .transform(somenteDigitos)
  .refine((d) => /^[1-9][1-9](9\d{8}|[2-5]\d{7})$/.test(d))

// bcrypt só considera os primeiros 72 bytes.
const senhaForte = z.string().min(8).max(72).regex(/[A-Za-z]/).regex(/\d/)
const imagemUrl = z.string().max(2048).transform((s) => s.trim()).refine((s) => {
  if (!s) return true
  if (s === '/barbershop-ambient.png') return true
  try { return new URL(s).protocol === 'https:' } catch { return false }
}, 'Use um link HTTPS válido para a imagem.')

export const loginSchema = z.object({ email, senha: z.string().min(1).max(72) })

export const cadastroSchema = z.object({
  nome,
  telefone,
  email,
  senha: senhaForte,
  aceitoTermos: z.literal(true),
  role: z.string().max(20).optional(), // lido só para decidir cliente/barbeiro; "admin" é ignorado
  codigoConvite: z.string().max(64).optional(),
})

export const agendamentoSchema = z.object({
  servicoId: z.number().int().positive(),
  barberId: z.number().int().positive(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5][05]$/), // múltiplos de 5; a grade do cliente é validada em horarioValido
  clienteId: z.number().int().positive().optional(), // só equipe; para cliente é ignorado
})
// O cliente NUNCA envia clienteId, preço ou duração: tudo isso vem do servidor.

export const agendamentoPublicoSchema = z.object({
  servicoId: z.number().int().positive(),
  barberId: z.number().int().positive(),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hora: z.string().regex(/^([01]\d|2[0-3]):[0-5][05]$/),
  nome,
  telefone,
  aceitoTermos: z.literal(true),
})

export const barbeariaConfigSchema = z.object({
  nome: z.string().max(180).transform((s) => limparTexto(s, 70)).refine((s) => s.length >= 2),
  slogan: z.string().max(240).transform((s) => limparTexto(s, 100)),
  slug: z.string().max(100).transform((s) => s.trim().toLowerCase()).refine(slugValido),
  corPrimaria: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  corFundo: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  imagemAmbiente: imagemUrl.default('/barbershop-ambient.png'),
})

export const onboardingSchema = z.object({
  nomeBarbearia: z.string().max(180).transform((s) => limparTexto(s, 70)).refine((s) => s.length >= 2),
  slogan: z.string().max(240).transform((s) => limparTexto(s, 100)).default(''),
  slug: z.string().max(100).transform((s) => s.trim().toLowerCase()).refine(slugValido),
  corPrimaria: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  corFundo: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  nome,
  telefone,
  email,
  senha: senhaForte,
  aceitoTermos: z.literal(true),
})

export const FORMAS = ['dinheiro', 'pix', 'debito', 'credito'] as const
export const statusSchema = z.object({
  status: z.enum(['agendado', 'concluido', 'faltou', 'cancelado']),
  formaPagamento: z.enum(FORMAS).optional(), // obrigatória ao concluir
})
export const idSchema = z.coerce.number().int().positive()
export const exclusaoSchema = z.object({ confirmar: z.literal(true) })

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const curto = (max: number) => z.string().max(max * 3).transform((s) => limparTexto(s, max))
const dinheiro = (n: number) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6

export const barbeiroSchema = z.object({
  nome: curto(60).refine((s) => s.length >= 2),
  foto: imagemUrl.optional(),
  comissao: z.number().int().min(0).max(100),
  ativo: z.boolean().optional(),
})
export const barbeiroPatchSchema = barbeiroSchema.partial().refine((o) => Object.keys(o).length > 0)

export const servicoSchema = z.object({
  nome: curto(60).refine((s) => s.length >= 2),
  preco: z.number().min(1).max(9999).refine(dinheiro),
  dur: z.number().int().min(5).max(480).refine((n) => n % 5 === 0),
  ativo: z.boolean().optional(),
})
export const servicoPatchSchema = servicoSchema.partial().refine((o) => Object.keys(o).length > 0)

export const horarioSchema = z
  .object({
    abre: hhmm, fecha: hhmm,
    almocoIni: hhmm.nullable(), almocoFim: hhmm.nullable(),
    dias: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  })
  .refine((h) => h.abre < h.fecha)
  .refine(
    (h) =>
      (h.almocoIni === null && h.almocoFim === null) ||
      (h.almocoIni !== null && h.almocoFim !== null && h.almocoIni < h.almocoFim && h.almocoIni >= h.abre && h.almocoFim <= h.fecha)
  )

export const dataSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export const mesSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)

export const bloqueioSchema = z
  .object({
    barberId: z.number().int().positive().optional(), // só admin usa; barbeiro é forçado ao próprio id
    data: dataSchema, ini: hhmm, fim: hhmm,
    motivo: curto(60).optional(),
  })
  .refine((b) => b.fim > b.ini)

export const clienteNovoSchema = z.object({ nome, telefone, email: email.optional() })
export const notaSchema = z.object({
  texto: z.string().max(1500).transform((s) => limparTexto(s, 500)).refine((s) => s.length > 0),
})
