// GET /api/me — devuelve el usuario de la sesión actual, su token de websocket
// y los datos de la otra persona (para presencia y estado "escribiendo")
import { NextResponse } from 'next/server'
import { db, ensureDb } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  await ensureDb()
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const partner = await db.user.findFirst({
    where: { id: { not: session.user.id } },
    select: { username: true, name: true },
  })

  return NextResponse.json({
    user: session.user,
    token: session.token,
    partner: partner ?? null,
  })
}
