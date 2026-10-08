// Testes das regras puras (sem banco): npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { horariosLivresDe, minutosAte, regraHorario, type Contexto } from '@/lib/horarios'
import { calcular } from '@/lib/financeiro'
import type { Agendamento, Nomes } from '@/lib/db'
import { contaBarbeiroAtiva, transicaoStatusPermitida } from '@/lib/regras-agendamento'
import { onboardingPublicoAtivo } from '@/lib/onboarding'
import { normalizarSlug, slugValido } from '@/lib/slug-barbearia'
import { filtroClientesTenant } from '@/lib/tenant-scope'
import { agendamentoPublicoSchema, barbeariaConfigSchema, onboardingSchema } from '@/lib/validation'

// "Agora" fixo: terça-feira 2026-10-06 10:00 (Brasília).
const AGORA = '2026-10-06 10:00'
const ctx = (o: Partial<Contexto> = {}): Contexto => ({
  horario: { abre: '09:00', fecha: '19:00', almocoIni: '12:00', almocoFim: '13:00', dias: [1, 2, 3, 4, 5, 6] },
  bloqueios: [], ocupados: [], agora: AGORA, ...o,
})
const QUARTA = '2026-10-07'
const DOMINGO = '2026-10-11'

test('grade: cliente só nos múltiplos do passo; equipe de 5 em 5', () => {
  assert.equal(regraHorario(ctx(), QUARTA, '09:00', 30), null)
  assert.equal(regraHorario(ctx(), QUARTA, '09:05', 30), 'grade')
  assert.equal(regraHorario(ctx(), QUARTA, '09:05', 30, true), null)
})

test('almoço, expediente, dia fechado e janela', () => {
  assert.equal(regraHorario(ctx(), QUARTA, '12:00', 30), 'almoco')
  assert.equal(regraHorario(ctx(), QUARTA, '11:45', 30), 'almoco')
  assert.equal(regraHorario(ctx(), QUARTA, '08:30', 30), 'expediente')
  assert.equal(regraHorario(ctx(), QUARTA, '18:45', 30), 'expediente')
  assert.equal(regraHorario(ctx(), DOMINGO, '10:00', 30), 'fechado')
  assert.equal(regraHorario(ctx(), '2020-01-01', '10:00', 30), 'janela')
  assert.equal(regraHorario(ctx(), '2026-11-30', '10:00', 30), 'janela') // >14 dias para o cliente
  assert.equal(regraHorario(ctx(), '2026-11-30', '10:00', 30, true), null) // equipe: até 60 dias
  assert.equal(regraHorario(ctx(), '2026-02-30', '10:00', 30), 'data')
})

test('passado: cliente não; equipe pode encaixar hoje', () => {
  assert.equal(regraHorario(ctx(), '2026-10-06', '09:30', 30), 'passado')
  assert.equal(regraHorario(ctx(), '2026-10-06', '09:30', 30, true), 'passado')
  assert.equal(regraHorario(ctx(), '2026-10-06', '09:45', 30, true), null)
  assert.equal(regraHorario(ctx(), '2026-10-06', '10:30', 30), null)
})

test('conta de barbeiro desativado não autentica nem renova sessão', () => {
  assert.equal(contaBarbeiroAtiva('admin'), true)
  assert.equal(contaBarbeiroAtiva('cliente'), true)
  assert.equal(contaBarbeiroAtiva('barbeiro', true), true)
  assert.equal(contaBarbeiroAtiva('barbeiro', false), false)
  assert.equal(contaBarbeiroAtiva('barbeiro', null), false)
})

test('atendimento concluído e cancelado permanecem terminais', () => {
  assert.equal(transicaoStatusPermitida('admin', 'concluido', 'agendado'), false)
  assert.equal(transicaoStatusPermitida('barbeiro', 'concluido', 'faltou'), false)
  assert.equal(transicaoStatusPermitida('admin', 'cancelado', 'agendado'), false)
  assert.equal(transicaoStatusPermitida('admin', 'agendado', 'concluido'), true)
  assert.equal(transicaoStatusPermitida('barbeiro', 'faltou', 'agendado'), true)
  assert.equal(transicaoStatusPermitida('cliente', 'agendado', 'cancelado'), true)
  assert.equal(transicaoStatusPermitida('cliente', 'agendado', 'concluido'), false)
})

test('onboarding publico fica fechado por padrao em producao', () => {
  assert.equal(onboardingPublicoAtivo('development'), true)
  assert.equal(onboardingPublicoAtivo('production'), false)
  assert.equal(onboardingPublicoAtivo('production', '1'), true)
})

test('conflito, bloqueio e horários livres', () => {
  const c = ctx({ ocupados: [{ hora: '10:00', dur: 45 }], bloqueios: [{ ini: '15:00', fim: '16:00' }] })
  assert.equal(regraHorario(c, QUARTA, '10:15', 30), 'ocupado')
  assert.equal(regraHorario(c, QUARTA, '10:45', 30), null)
  assert.equal(regraHorario(c, QUARTA, '15:30', 30), 'bloqueado')
  const livres = horariosLivresDe(c, QUARTA, 30)
  assert.ok(livres.includes('09:00') && livres.includes('10:45'))
  assert.ok(!livres.includes('10:00') && !livres.includes('10:30') && !livres.includes('12:00') && !livres.includes('15:30'))
})

test('serviço de 20 min respeita o fechamento', () => {
  const livres = horariosLivresDe(ctx(), QUARTA, 20)
  assert.equal(livres[0], '09:00')
  assert.ok(livres.every((h) => h <= '18:40'))
})

test('minutosAte: futuro positivo, passado negativo', () => {
  assert.equal(minutosAte({ data: '2026-10-06', hora: '12:00' }, AGORA), 120)
  assert.ok(minutosAte({ data: '2026-10-06', hora: '09:00' }, AGORA) < 0)
})

test('slug de barbearia: normaliza nomes e impede colisão com rotas da aplicação', () => {
  assert.equal(normalizarSlug('  Barbearia São José  '), 'barbearia-sao-jose')
  assert.equal(normalizarSlug('Corte & Estilo 2026'), 'corte-estilo-2026')
  assert.equal(normalizarSlug('á'.repeat(60)).length, 48)
  assert.equal(slugValido('barbearia-sao-jose'), true)
  assert.equal(slugValido('admin'), false)
  assert.equal(slugValido('api'), false)
  assert.equal(slugValido('meu--espaco'), false)
  assert.equal(slugValido('ab'), false)
})

test('filtro de clientes sempre prende os resultados à barbearia da sessão', () => {
  assert.deepEqual(filtroClientesTenant({ id: 8, barbeariaId: 2, role: 'admin' }), {
    barbeariaId: 2,
    role: 'cliente',
  })
  assert.deepEqual(filtroClientesTenant({ id: 8, barbeariaId: 2, role: 'barbeiro', barberId: 4 }), {
    barbeariaId: 2,
    role: 'cliente',
    OR: [
      { agendamentos: { some: { barbeariaId: 2, barberId: 4 } } },
      { criadoPorId: 8 },
    ],
  })
})

test('agendamento público normaliza nome e telefone e exige aceite dos termos', () => {
  const dados = {
    servicoId: 2, barberId: 3, data: '2026-10-08', hora: '10:15',
    nome: '  João   Silva  ', telefone: '(62) 99999-0000', aceitoTermos: true,
  }
  const valido = agendamentoPublicoSchema.safeParse(dados)
  assert.equal(valido.success, true)
  if (valido.success) {
    assert.equal(valido.data.nome, 'João Silva')
    assert.equal(valido.data.telefone, '62999990000')
  }
  assert.equal(agendamentoPublicoSchema.safeParse({ ...dados, aceitoTermos: false }).success, false)
  assert.equal(agendamentoPublicoSchema.safeParse({ ...dados, telefone: '123' }).success, false)
})

test('configuração da barbearia valida slug reservado e cores seguras', () => {
  const dados = { nome: 'Barbearia São José', slogan: 'Seu estilo', slug: 'barbearia-sao-jose', corPrimaria: '#1177aa', corFundo: '#09090b' }
  assert.equal(barbeariaConfigSchema.safeParse(dados).success, true)
  assert.equal(barbeariaConfigSchema.safeParse({ ...dados, slug: 'admin' }).success, false)
  assert.equal(barbeariaConfigSchema.safeParse({ ...dados, slug: 'barbearia--sao' }).success, false)
  assert.equal(barbeariaConfigSchema.safeParse({ ...dados, corPrimaria: 'red' }).success, false)
})

test('onboarding valida identidade, responsável e aceite dos termos', () => {
  const dados = {
    nomeBarbearia: 'Barbearia São José', slogan: 'Seu estilo', slug: 'barbearia-sao-jose',
    corPrimaria: '#1177aa', corFundo: '#09090b', nome: 'João Silva', telefone: '(62) 99999-0000',
    email: 'joao@example.com', senha: 'Barbeiro123', aceitoTermos: true,
  }
  const valido = onboardingSchema.safeParse(dados)
  assert.equal(valido.success, true)
  if (valido.success) assert.equal(valido.data.telefone, '62999990000')
  assert.equal(onboardingSchema.safeParse({ ...dados, slug: 'admin' }).success, false)
  assert.equal(onboardingSchema.safeParse({ ...dados, senha: '12345678' }).success, false)
  assert.equal(onboardingSchema.safeParse({ ...dados, aceitoTermos: false }).success, false)
})

const ag = (o: Partial<Agendamento>): Agendamento => ({
  id: 1, clienteId: 1, clienteNome: 'A', clienteTel: '', barberId: 1, servicoId: 1, data: '2026-01-05', hora: '09:00',
  dur: 30, preco: 40, cadeira: 1, status: 'concluido', criadoEm: '', forma: 'pix', comissaoPct: 40, ...o,
})
const nomes: Nomes = { barb: new Map([[1, 'João']]), serv: new Map([[1, 'Corte']]) }

test('financeiro: centavos, comissão congelada e taxa de falta', () => {
  const r = calcular([
    ag({ id: 1, preco: 40.1, comissaoPct: 40 }),
    ag({ id: 2, preco: 59.9, comissaoPct: 50, forma: 'dinheiro' }),
    ag({ id: 3, status: 'faltou' }),
    ag({ id: 4, status: 'agendado', preco: 30 }),
  ], nomes)
  assert.equal(r.bruto, 100)
  assert.equal(r.comissoes, 45.99)
  assert.equal(r.liquido, 54.01)
  assert.equal(r.taxaFalta, 33.3)
  assert.equal(r.previsto, 30)
  assert.deepEqual(r.porForma, { pix: 40.1, dinheiro: 59.9 })
  assert.equal(r.porBarbeiro[0].nome, 'João')
})
