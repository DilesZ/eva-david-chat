// POST /api/messages/[id]/reactions — alterna (toggle) una reacción con emoji.
// Solo el autor del toggle la pone o la quita; cualquiera puede reaccionar.
import { NextResponse } from 'next/server'
import { db, ensureDb } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { REACTION_EMOJIS, toPayload, withExtras, messageInclude } from '@/lib/messages'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureDb()
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  const { id } = await params
  const messageId = Number(id)
  if (!Number.isInteger(messageId) || messageId <= 0) {
    return NextResponse.json({ error: 'Identificador no válido' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const emoji = typeof body?.emoji === 'string' ? body.emoji : ''
  if (!(REACTION_EMOJIS as readonly string[]).includes(emoji)) {
    return NextResponse.json({ error: 'Emoji no permitido' }, { status: 400 })
  }

  const target = await db.message.findFirst({
    where: { id: messageId, deletedAt: null },
    select: { id: true },
  })
  if (!target) {
    return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 })
  }

  const existing = await db.reaction.findUnique({
    where: {
      messageId_userId_emoji: { messageId, userId: session.user.id, emoji },
    },
  })
  if (existing) {
    await db.reaction.delete({ where: { id: existing.id } })
  } else {
    await db.reaction.create({
      data: { messageId, userId: session.user.id, emoji },
    })
  }

  const updated = await db.message.update({
    where: { id: messageId },
    data: { reactionsUpdatedAt: new Date() },
    include: messageInclude,
  })
  const [payload] = await withExtras([toPayload(updated)], session.user.username)
  return NextResponse.json({ message: payload, reacted: !existing })
}
