import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { after, before, test } from 'node:test'
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { criarSessao } from '@/lib/auth'
import { COOKIES } from '@/lib/jwt'
import { toUsuario } from '@/lib/db'
import { GET as catalogoPublico, POST as reservarPublico } from '@/app/api/publico/[slug]/route'
import { GET as listarServicos } from '@/app/api/admin/servicos/route'
import { PATCH as alterarServico } from '@/app/api/admin/servicos/[id]/route'
import { GET as listarBarbeiros } from '@/app/api/admin/barbeiros/route'
import { PATCH as alterarBarbeiro } from '@/app/api/admin/barbeiros/[id]/route'
import { POST as criarBarbearia } from '@/app/api/onboarding/route'
import { GET as listarClientes } from '@/app/api/clientes/route'
import { GET as fichaCliente } from '@/app/api/clientes/[id]/route'
import { POST as criarNota } from '@/app/api/clientes/[id]/notas/route'
import { GET as listarAgendamentos } from '@/app/api/agendamentos/route'
import { GET as catalogoInterno } from '@/app/api/catalogo/route'
import { GET as caixa } from '@/app/api/admin/financeiro/caixa/route'
import { GET as verHorario, PUT as alterarHorario } from '@/app/api/admin/horarios/route'
import { GET as listarBloqueios, POST as criarBloqueio } from '@/app/api/bloqueios/route'
import { GET as verConvites, POST as criarConvite } from '@/app/api/admin/convites/route'
import { GET as relatorioFinanceiro } from '@/app/api/admin/financeiro/relatorio/route'
import { PATCH as alterarAgendamento } from '@/app/api/agendamentos/[id]/route'
import { GET as verComissao } from '@/app/api/barbeiro/comissao/route'
import { GET as health } from '@/app/api/health/route'
import { POST as cadastro } from '@/app/api/auth/cadastro/route'

const origem = 'http://localhost:3000'
const csrf = 'isolation-test-csrf-token'
const sufixo = randomBytes(6).toString('hex')
const lojas: { id: number; slug: string }[] = []
const usuarios: number[] = []
const servicos: { a: number; b: number } = { a: 0, b: 0 }
const barbeiros: { a: number; b: number } = { a: 0, b: 0 }
const clientes: { a: number; b: number } = { a: 0, b: 0 }
const agendamentos: { a: number; b: number } = { a: 0, b: 0 }
const sessoes: { a: string; b: string } = { a: '', b: '' }
const sessoesBarbeiro: { a: string; b: string } = { a: '', b: '' }
const ipsTeste = [1, 2, 3].map((n) => `198.51.100.${1 + ((Number.parseInt(sufixo.slice(n * 2, n * 2 + 2), 16) || n) % 254)}`)
const ipCadastroRecepcao = `198.51.100.${ipsTeste.length + 40}`

function requisicao(caminho: string, op: { token?: string; method?: string; body?: unknown; ip?: string } = {}) {
  const cookie = [
    `${COOKIES.csrf}=${csrf}`,
    ...(op.token ? [`${COOKIES.at}=${op.token}`] : []),
  ].join('; ')
  return new NextRequest(`${origem}${caminho}`, {
    method: op.method ?? 'GET',
    headers: {
      origin: origem,
      cookie,
      'x-csrf-token': csrf,
      'content-type': 'application/json',
      ...(op.ip ? { 'x-forwarded-for': op.ip } : {}),
    },
    ...(op.body === undefined ? {} : { body: JSON.stringify(op.body) }),
  })
}

async function tokenAdmin(usuarioId: number) {
  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId } })
  const resposta = new NextResponse()
  await criarSessao(resposta, toUsuario(usuario))
  return resposta.cookies.get(COOKIES.at)?.value ?? ''
}

function dataAmanha() {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(Date.now() + 24 * 60 * 60 * 1000))
  const parte = (tipo: string) => p.find((x) => x.type === tipo)?.value ?? ''
  return `${parte('year')}-${parte('month')}-${parte('day')}`
}

before(async () => {
  await prisma.$connect()
  for (const [chave, nome] of [['a', 'Loja A'], ['b', 'Loja B']] as const) {
    const loja = await prisma.barbearia.create({
      data: { nome: `${nome} teste`, slug: `iso-${chave}-${sufixo}`, slogan: 'Teste isolado' },
      select: { id: true, slug: true },
    })
    lojas.push(loja)
    const barbeiro = await prisma.barbeiro.create({ data: { barbeariaId: loja.id, nome: `Profissional ${chave}`, comissao: 40 } })
    const servico = await prisma.servico.create({ data: { barbeariaId: loja.id, nome: `Servico ${chave}`, precoCent: 4500, dur: 30 } })
    const usuario = await prisma.usuario.create({
      data: {
        barbeariaId: loja.id, nome: `Dono ${chave} Teste`, email: `iso-${chave}-${sufixo}@example.test`,
        telefone: `629${sufixo.slice(0, 8)}`, role: 'admin', senhaHash: 'integration-test-only',
      },
    })
    usuarios.push(usuario.id)
    const usuarioBarbeiro = await prisma.usuario.create({
      data: {
        barbeariaId: loja.id, barberId: barbeiro.id, nome: `Barbeiro ${chave} Teste`,
        email: `barbeiro-${chave}-${sufixo}@example.test`, telefone: `628${sufixo.slice(0, 8)}`,
        role: 'barbeiro', senhaHash: 'integration-test-only',
      },
    })
    usuarios.push(usuarioBarbeiro.id)
    barbeiros[chave] = barbeiro.id
    servicos[chave] = servico.id
    await prisma.horario.create({
      data: { id: loja.id, barbeariaId: loja.id, abre: '08:00', fecha: '20:00', almocoIni: null, almocoFim: null, dias: [0, 1, 2, 3, 4, 5, 6] },
    })
    const cliente = await prisma.usuario.create({
      data: { barbeariaId: loja.id, nome: `Cliente ${chave} Teste`, email: null, telefone: `6298888${chave === 'a' ? '0001' : '0002'}`, role: 'cliente', senhaHash: '', semConta: true },
    })
    clientes[chave] = cliente.id
    await prisma.agendamento.create({
      data: {
        barbeariaId: loja.id, clienteId: cliente.id, clienteNome: cliente.nome, clienteTel: cliente.telefone,
        barberId: barbeiro.id, servicoId: servico.id, data: '2026-10-10', hora: '10:00', dur: 30, precoCent: 4500,
        status: 'concluido', forma: 'pix', comissaoPct: 40, pagoEm: new Date(),
      },
    })
    const pendente = await prisma.agendamento.create({
      data: {
        barbeariaId: loja.id, clienteId: cliente.id, clienteNome: cliente.nome, clienteTel: cliente.telefone,
        barberId: barbeiro.id, servicoId: servico.id, data: '2026-10-10', hora: '15:30', dur: 30, precoCent: 4500,
        status: 'agendado',
      },
    })
    agendamentos[chave] = pendente.id
    sessoes[chave] = await tokenAdmin(usuario.id)
    sessoesBarbeiro[chave] = await tokenAdmin(usuarioBarbeiro.id)
  }
})

after(async () => {
  const ids = lojas.map((loja) => loja.id)
  if (ids.length) {
    await prisma.agendamento.deleteMany({ where: { barbeariaId: { in: ids } } })
    await prisma.auditoria.deleteMany({ where: { barbeariaId: { in: ids } } })
    await prisma.bloqueio.deleteMany({ where: { barbeariaId: { in: ids } } })
    await prisma.nota.deleteMany({ where: { barbeariaId: { in: ids } } })
    await prisma.convite.deleteMany({ where: { barbeariaId: { in: ids } } })
    await prisma.sessao.deleteMany({ where: { userId: { in: usuarios } } })
    await prisma.usuario.deleteMany({ where: { barbeariaId: { in: ids } } })
    await prisma.horario.deleteMany({ where: { barbeariaId: { in: ids } } })
    await prisma.servico.deleteMany({ where: { barbeariaId: { in: ids } } })
    await prisma.barbeiro.deleteMany({ where: { barbeariaId: { in: ids } } })
    const chavesTeste = [
      ...ids.map((id) => `publico-agendar:${id}:desconhecido`),
      ...ipsTeste.map((ip) => `onboarding:${ip}`),
      `cadastro:${ipCadastroRecepcao}`,
      ...usuarios.map((id) => `convite:${id}`),
    ]
    await prisma.rateLimit.deleteMany({ where: { chave: { in: chavesTeste } } })
    await prisma.barbearia.deleteMany({ where: { id: { in: ids } } })
  }
  await prisma.$disconnect()
})

test('rotas publicas isolam catalogo e recusam IDs de outra barbearia', async () => {
  const catalogoA = await catalogoPublico(requisicao(`/api/publico/${lojas[0].slug}`), { params: Promise.resolve({ slug: lojas[0].slug }) })
  assert.equal(catalogoA.status, 200)
  const corpoA = await catalogoA.json()
  assert.deepEqual(corpoA.servicos.map((item: { id: number }) => item.id), [servicos.a])
  assert.deepEqual(corpoA.barbeiros.map((item: { id: number }) => item.id), [barbeiros.a])

  const reservaValida = await reservarPublico(
    requisicao(`/api/publico/${lojas[0].slug}`, {
      method: 'POST',
      body: { servicoId: servicos.a, barberId: barbeiros.a, data: dataAmanha(), hora: '11:00', nome: 'Cliente Teste', telefone: '62999990001', aceitoTermos: true },
    }),
    { params: Promise.resolve({ slug: lojas[0].slug }) },
  )
  assert.equal(reservaValida.status, 201)
  assert.equal(await prisma.agendamento.count({ where: { barbeariaId: lojas[0].id } }), 3)

  const respostaCruzada = await reservarPublico(
    requisicao(`/api/publico/${lojas[0].slug}`, {
      method: 'POST',
      body: { servicoId: servicos.a, barberId: barbeiros.b, data: dataAmanha(), hora: '11:30', nome: 'Cliente Teste', telefone: '62999990002', aceitoTermos: true },
    }),
    { params: Promise.resolve({ slug: lojas[0].slug }) },
  )
  assert.equal(respostaCruzada.status, 400)
  assert.equal(await prisma.agendamento.count({ where: { barbeariaId: lojas[0].id } }), 3)
})

test('rotas administrativas listam apenas o tenant da sessao e ocultam IDs estrangeiros', async () => {
  const catalogoA = await catalogoInterno(requisicao('/api/catalogo', { token: sessoes.a }), {})
  assert.equal(catalogoA.status, 200)
  assert.equal((await catalogoA.json()).barbearia.slug, lojas[0].slug)

  const lista = await listarServicos(requisicao('/api/admin/servicos', { token: sessoes.a }), {})
  assert.equal(lista.status, 200)
  const corpo = await lista.json()
  assert.deepEqual(corpo.servicos.map((item: { id: number }) => item.id), [servicos.a])

  const resposta = await alterarServico(
    requisicao(`/api/admin/servicos/${servicos.b}`, { method: 'PATCH', token: sessoes.a, body: { nome: 'Alterado indevidamente' } }),
    { params: Promise.resolve({ id: String(servicos.b) }) },
  )
  assert.equal(resposta.status, 404)
  const servicoB = await prisma.servico.findUniqueOrThrow({ where: { id: servicos.b } })
  assert.equal(servicoB.nome, 'Servico b')

  const equipeA = await listarBarbeiros(requisicao('/api/admin/barbeiros', { token: sessoes.a }), {})
  assert.equal(equipeA.status, 200)
  assert.deepEqual((await equipeA.json()).barbeiros.map((item: { id: number }) => item.id), [barbeiros.a])

  const barbeiroEstrangeiro = await alterarBarbeiro(
    requisicao(`/api/admin/barbeiros/${barbeiros.b}`, { method: 'PATCH', token: sessoes.a, body: { nome: 'Alterado indevidamente' } }),
    { params: Promise.resolve({ id: String(barbeiros.b) }) },
  )
  assert.equal(barbeiroEstrangeiro.status, 404)
  assert.equal((await prisma.barbeiro.findUniqueOrThrow({ where: { id: barbeiros.b } })).nome, 'Profissional b')
})

test('clientes, agenda, notas e caixa permanecem separados por tenant', async () => {
  const clientesA = await listarClientes(requisicao('/api/clientes', { token: sessoes.a }), {})
  assert.equal(clientesA.status, 200)
  const listaClientesA = await clientesA.json()
  const idsClientesA = listaClientesA.clientes.map((item: { id: number }) => item.id)
  assert.ok(idsClientesA.includes(clientes.a))
  assert.ok(!idsClientesA.includes(clientes.b))

  const fichaEstrangeira = await fichaCliente(
    requisicao(`/api/clientes/${clientes.b}`, { token: sessoes.a }),
    { params: Promise.resolve({ id: String(clientes.b) }) },
  )
  assert.equal(fichaEstrangeira.status, 403)

  const notaEstrangeira = await criarNota(
    requisicao(`/api/clientes/${clientes.b}/notas`, { method: 'POST', token: sessoes.a, body: { texto: 'Nao deve existir' } }),
    { params: Promise.resolve({ id: String(clientes.b) }) },
  )
  assert.equal(notaEstrangeira.status, 403)
  assert.equal(await prisma.nota.count({ where: { barbeariaId: lojas[1].id } }), 0)

  const agendaA = await listarAgendamentos(requisicao('/api/agendamentos', { token: sessoes.a }), {})
  assert.equal(agendaA.status, 200)
  const listaAgendaA = await agendaA.json()
  assert.ok(listaAgendaA.agendamentos.every((item: { barberId: number; servicoId: number }) => item.barberId === barbeiros.a && item.servicoId === servicos.a))

  const caixaA = await caixa(requisicao('/api/admin/financeiro/caixa?data=2026-10-10', { token: sessoes.a }), {})
  assert.equal(caixaA.status, 200)
  const resumoCaixaA = await caixaA.json()
  assert.equal(resumoCaixaA.bruto, 45)
  assert.equal(resumoCaixaA.movimentos.length, 1)
  assert.equal(resumoCaixaA.movimentos[0].cliente, 'Cliente a Teste')
})

test('horarios e bloqueios permanecem restritos a barbearia da sessao', async () => {
  const horarioA = await verHorario(requisicao('/api/admin/horarios', { token: sessoes.a }), {})
  assert.equal(horarioA.status, 200)
  assert.equal((await horarioA.json()).horario.abre, '08:00')

  const alterarA = await alterarHorario(requisicao('/api/admin/horarios', {
    method: 'PUT', token: sessoes.a,
    body: { abre: '09:00', fecha: '19:00', almocoIni: '12:00', almocoFim: '13:00', dias: [1, 2, 3, 4, 5, 6] },
  }), {})
  assert.equal(alterarA.status, 200)
  const horarioB = await prisma.horario.findFirstOrThrow({ where: { barbeariaId: lojas[1].id } })
  assert.equal(horarioB.abre, '08:00')

  const bloqueioEstrangeiro = await criarBloqueio(requisicao('/api/bloqueios', {
    method: 'POST', token: sessoes.a,
    body: { barberId: barbeiros.b, data: dataAmanha(), ini: '14:00', fim: '15:00', motivo: 'Nao pode criar' },
  }), {})
  assert.equal(bloqueioEstrangeiro.status, 400)

  const bloqueioA = await criarBloqueio(requisicao('/api/bloqueios', {
    method: 'POST', token: sessoes.a,
    body: { barberId: barbeiros.a, data: dataAmanha(), ini: '14:00', fim: '15:00', motivo: 'Teste isolado' },
  }), {})
  assert.equal(bloqueioA.status, 201)

  const listaComFiltroEstrangeiro = await listarBloqueios(
    requisicao(`/api/bloqueios?barberId=${barbeiros.b}`, { token: sessoes.a }), {},
  )
  assert.equal(listaComFiltroEstrangeiro.status, 200)
  assert.deepEqual((await listaComFiltroEstrangeiro.json()).bloqueios, [])
})

test('convites de equipe respeitam o papel e isolam cada barbearia', async () => {
  const conviteA = await criarConvite(requisicao('/api/admin/convites', { method: 'POST', token: sessoes.a }), {})
  assert.equal(conviteA.status, 201)
  const corpoConviteA = await conviteA.json()
  assert.equal(typeof corpoConviteA.codigo, 'string')
  assert.match(corpoConviteA.codigo, /^B-[\w-]{12}$/)

  const conviteRecepcao = await criarConvite(requisicao('/api/admin/convites', {
    method: 'POST', token: sessoes.a, body: { role: 'recepcionista' },
  }), {})
  assert.equal(conviteRecepcao.status, 201)
  const corpoConviteRecepcao = await conviteRecepcao.json()
  assert.match(corpoConviteRecepcao.codigo, /^R-/)

  const pendentesA = await verConvites(requisicao('/api/admin/convites', { token: sessoes.a }), {})
  const pendentesB = await verConvites(requisicao('/api/admin/convites', { token: sessoes.b }), {})
  assert.equal(pendentesA.status, 200)
  assert.equal(pendentesB.status, 200)
  assert.equal((await pendentesA.json()).pendentes, 2)
  assert.equal((await pendentesB.json()).pendentes, 0)

  const ip = ipCadastroRecepcao
  const agora = Date.now()
  const contaBarbeiro = await cadastro(requisicao('/api/auth/cadastro', {
    method: 'POST', ip,
    body: {
      nome: 'Barbeiro de Teste', telefone: `629${String(agora).slice(-8)}`,
      email: `barbeiro-novo-${sufixo}@example.test`, senha: 'Barbearia123', aceitoTermos: true,
      role: 'barbeiro', codigoConvite: corpoConviteA.codigo,
    },
  }), {})
  assert.equal(contaBarbeiro.status, 201)
  const corpoBarbeiro = await contaBarbeiro.json()
  assert.equal(corpoBarbeiro.usuario.role, 'barbeiro')
  const barbeiroPersistido = await prisma.usuario.findUniqueOrThrow({ where: { id: corpoBarbeiro.usuario.id } })
  usuarios.push(barbeiroPersistido.id)
  assert.equal(barbeiroPersistido.barbeariaId, lojas[0].id)
  assert.ok(barbeiroPersistido.barberId)

  const papelIncorreto = await cadastro(requisicao('/api/auth/cadastro', {
    method: 'POST', ip,
    body: {
      nome: 'Pessoa de Teste', telefone: `629${String(agora + 1).slice(-8)}`,
      email: `papel-invalido-${sufixo}@example.test`, senha: 'Barbearia123', aceitoTermos: true,
      role: 'barbeiro', codigoConvite: corpoConviteRecepcao.codigo,
    },
  }), {})
  assert.equal(papelIncorreto.status, 403)

  const contaRecepcao = await cadastro(requisicao('/api/auth/cadastro', {
    method: 'POST', ip,
    body: {
      nome: 'Atendente de Teste', telefone: `629${String(agora + 2).slice(-8)}`,
      email: `atendente-${sufixo}@example.test`, senha: 'Barbearia123', aceitoTermos: true,
      role: 'recepcionista', codigoConvite: corpoConviteRecepcao.codigo,
    },
  }), {})
  assert.equal(contaRecepcao.status, 201)
  const corpoConta = await contaRecepcao.json()
  assert.equal(corpoConta.usuario.role, 'recepcionista')
  const usuarioPersistido = await prisma.usuario.findUniqueOrThrow({ where: { id: corpoConta.usuario.id } })
  usuarios.push(usuarioPersistido.id)
  assert.equal(usuarioPersistido.barbeariaId, lojas[0].id)
  assert.equal(usuarioPersistido.barberId, null)
})

test('relatorios e alteracoes de agendamento nao atravessam barbearias', async () => {
  const relatorioA = await relatorioFinanceiro(
    requisicao('/api/admin/financeiro/relatorio?mes=2026-10&formato=csv', { token: sessoes.a }), {},
  )
  assert.equal(relatorioA.status, 200)
  const csvA = await relatorioA.text()
  assert.ok(csvA.includes('Cliente a Teste'))
  assert.ok(!csvA.includes('Cliente b Teste'))

  const alterarEstrangeiro = await alterarAgendamento(
    requisicao(`/api/agendamentos/${agendamentos.b}`, { method: 'PATCH', token: sessoes.a, body: { status: 'cancelado' } }),
    { params: Promise.resolve({ id: String(agendamentos.b) }) },
  )
  assert.equal(alterarEstrangeiro.status, 403)

  const cancelarProprio = await alterarAgendamento(
    requisicao(`/api/agendamentos/${agendamentos.a}`, { method: 'PATCH', token: sessoes.a, body: { status: 'cancelado' } }),
    { params: Promise.resolve({ id: String(agendamentos.a) }) },
  )
  assert.equal(cancelarProprio.status, 200)
  assert.equal((await prisma.agendamento.findUniqueOrThrow({ where: { id: agendamentos.a } })).status, 'cancelado')
})

test('visao de comissao do barbeiro nao inclui atendimentos de outra barbearia', async () => {
  const comissaoA = await verComissao(requisicao('/api/barbeiro/comissao?mes=2026-10', { token: sessoesBarbeiro.a }), {})
  const comissaoB = await verComissao(requisicao('/api/barbeiro/comissao?mes=2026-10', { token: sessoesBarbeiro.b }), {})
  assert.equal(comissaoA.status, 200)
  assert.equal(comissaoB.status, 200)
  const corpoA = await comissaoA.json()
  const corpoB = await comissaoB.json()
  assert.ok(corpoA.itens.length >= 1)
  assert.ok(corpoB.itens.length >= 1)
  assert.ok(corpoA.itens.every((item: { servico: string }) => item.servico === 'Servico a'))
  assert.ok(corpoB.itens.every((item: { servico: string }) => item.servico === 'Servico b'))
})

test('rota de saude confirma acesso ao banco sem expor detalhes', async () => {
  const resposta = await health()
  assert.equal(resposta.status, 200)
  assert.deepEqual(await resposta.json(), { ok: true })
  assert.equal(resposta.headers.get('cache-control'), 'no-store')
})

test('onboarding simultaneo com o mesmo slug e email cria exatamente uma barbearia', async () => {
  const payload = {
    nomeBarbearia: 'Estudio Concorrente', slogan: 'Teste de disputa', slug: `onboarding-${sufixo}`,
    corPrimaria: '#1177aa', corFundo: '#09090b', nome: 'Pessoa Responsavel',
    telefone: `629${String(Number.parseInt(sufixo.slice(0, 8), 16) % 100000000).padStart(8, '0')}`,
    email: `onboarding-${sufixo}@example.test`, senha: 'TesteForte2026', aceitoTermos: true,
  }
  const enviar = () => criarBarbearia(requisicao('/api/onboarding', { method: 'POST', body: payload, ip: ipsTeste[0] }), {})
  const respostas = await Promise.all([enviar(), enviar()])
  assert.deepEqual(respostas.map((r) => r.status).sort(), [201, 409])

  const lojaCriada = await prisma.barbearia.findUniqueOrThrow({ where: { slug: payload.slug } })
  lojas.push({ id: lojaCriada.id, slug: lojaCriada.slug })
  const donos = await prisma.usuario.findMany({ where: { barbeariaId: lojaCriada.id, email: payload.email } })
  assert.equal(donos.length, 1)
  assert.equal(await prisma.horario.count({ where: { barbeariaId: lojaCriada.id } }), 1)

  const mesmoSlug = await criarBarbearia(requisicao('/api/onboarding', {
    method: 'POST', body: { ...payload, email: `outro-${sufixo}@example.test` }, ip: ipsTeste[1],
  }), {})
  const mesmoEmail = await criarBarbearia(requisicao('/api/onboarding', {
    method: 'POST', body: { ...payload, slug: `onboarding-outro-${sufixo}` }, ip: ipsTeste[2],
  }), {})
  assert.equal(mesmoSlug.status, 409)
  assert.equal(mesmoEmail.status, 409)
  assert.equal(await prisma.barbearia.count({ where: { slug: { startsWith: `onboarding-outro-${sufixo}` } } }), 0)
})
