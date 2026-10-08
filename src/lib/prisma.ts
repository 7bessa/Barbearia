import { PrismaClient } from '@prisma/client'

// Uma única conexão por processo (evita esgotar conexões no hot reload do Next em dev).
const g = globalThis as unknown as { __prisma?: PrismaClient }
export const prisma = (g.__prisma ??= new PrismaClient({ log: process.env.NODE_ENV === 'production' ? ['error'] : ['warn', 'error'] }))
