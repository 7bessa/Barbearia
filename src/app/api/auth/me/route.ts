import { NextRequest, NextResponse } from 'next/server'
import { exigir, publico, seguro } from '@/lib/auth'

export const GET = seguro(async (req: NextRequest) => {
  const r = await exigir(req)
  if (!r.ok) return r.res
  return NextResponse.json({ usuario: publico(r.user) }, { headers: { 'Cache-Control': 'no-store' } })
})
