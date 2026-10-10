// POST /api/typing — avisa de "escribiendo" para el polling (sin websockets)
import { NextResponse } from 'next/server'
import { db, ensureDb } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function POST(req: Request) {
  await ensureDb()
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const typing = body?.typing === true
  await db.user
    .update({
      where: { id: session.user.id },
      data: { typingAt: typing ? new Date() : null, lastSeenAt: new Date() },
    })
    .catch(() => {})
  return NextResponse.json({ ok: true })
}
