// POST /api/messages/read — marca como leídos los mensajes de la otra persona
// hasta `lastMessageId` y difunde el evento para las marcas "visto" (✓✓)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { broadcastEvent } from '@/lib/broadcast'

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const lastMessageId = Number(body?.lastMessageId)
  if (!Number.isInteger(lastMessageId) || lastMessageId <= 0) {
    return NextResponse.json({ error: 'Identificador no válido' }, { status: 400 })
  }

  const updated = await db.message.updateMany({
    where: {
      id: { lte: lastMessageId },
      userId: { not: session.user.id },
      readAt: null,
    },
    data: { readAt: new Date() },
  })

  if (updated.count > 0) {
    try {
      await broadcastEvent('messages-read', {
        reader: session.user.username,
        lastMessageId,
      })
    } catch (err) {
      console.error('[messages/read] no se pudo difundir el recibo:', err)
    }
  }

  return NextResponse.json({ ok: true, updated: updated.count })
}
