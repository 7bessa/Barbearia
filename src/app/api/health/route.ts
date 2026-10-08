import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Endpoint para monitoramento da hospedagem. Não revela versão, banco ou erro interno.
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ ok: false }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}

export const dynamic = 'force-dynamic'
