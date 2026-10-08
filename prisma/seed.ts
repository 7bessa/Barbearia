// Dados iniciais (idempotente). Uso: npm run db:seed
// Produção: só cria admin (SEED_ADMIN_PASSWORD obrigatória), horário e serviços padrão.
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { BARBEARIA } from '../src/config/barbearia'

const prisma = new PrismaClient()
const prod = process.env.NODE_ENV === 'production'
const hash = (s: string) => bcrypt.hash(s, 12)
const senha = (nome: string) => {
  const v = process.env[nome]
  return v && v.length >= 8 ? v : null
}

async function main() {
  await prisma.horario.upsert({
    where: { barbeariaId: 1 },
    update: {},
    create: { id: 1, barbeariaId: 1, ...BARBEARIA.horario, dias: [...BARBEARIA.horario.dias] },
  })

  if ((await prisma.servico.count()) === 0) {
    await prisma.servico.createMany({
      data: [
        { barbeariaId: 1, nome: 'Corte', precoCent: 4000, dur: 30 },
        { barbeariaId: 1, nome: 'Corte+Barba', precoCent: 6000, dur: 45 },
        { barbeariaId: 1, nome: 'Barba', precoCent: 3000, dur: 20 },
      ],
    })
  }

  const adminSenha = senha('SEED_ADMIN_PASSWORD')
  if (!adminSenha && prod) throw new Error('SEED_ADMIN_PASSWORD (mín. 8 caracteres) é obrigatória em produção')
  if (adminSenha) {
    await prisma.usuario.upsert({
      where: { email: process.env.SEED_ADMIN_EMAIL ?? 'admin@b.com' },
      update: {},
      create: {
        nome: 'Dono', email: process.env.SEED_ADMIN_EMAIL ?? 'admin@b.com',
        barbeariaId: 1,
        telefone: process.env.SEED_ADMIN_TELEFONE ?? '62999990003', role: 'admin', senhaHash: await hash(adminSenha),
      },
    })
  }

  if (!prod) {
    if ((await prisma.barbeiro.count()) === 0) {
      await prisma.barbeiro.createMany({
        data: ['João', 'Pedro', 'Carlos'].map((nome) => ({ barbeariaId: 1, nome, comissao: BARBEARIA.comissaoPadrao })),
      })
    }
    const joao = await prisma.barbeiro.findFirst({ where: { nome: 'João' }, orderBy: { id: 'asc' } })
    const cs = senha('SEED_CLIENTE_PASSWORD')
    const bs = senha('SEED_BARBEIRO_PASSWORD')
    if (cs) {
      await prisma.usuario.upsert({
        where: { email: 'cliente@b.com' }, update: {},
        create: { barbeariaId: 1, nome: 'Marcos Oliveira Silva', email: 'cliente@b.com', telefone: '62999990001', role: 'cliente', senhaHash: await hash(cs) },
      })
    }
    if (bs && joao) {
      await prisma.usuario.upsert({
        where: { email: 'barbeiro@b.com' }, update: {},
        create: { barbeariaId: 1, nome: 'João Pereira', email: 'barbeiro@b.com', telefone: '62999990002', role: 'barbeiro', barberId: joao.id, senhaHash: await hash(bs) },
      })
    }
  }
  console.log('Seed concluído.')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
