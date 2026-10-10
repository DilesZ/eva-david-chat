// POST /api/messages/[id]/reactions — alterna (toggle) una reacción con emoji.
// Solo el autor del toggle la pone o la quita; cualquiera puede reaccionar.
import { NextResponse } from 'next/server'
import { db, ensureDb } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { toPayload, withExtras, messageInclude } from '@/lib/messages'

// Acepta cualquier emoji Unicode (pictográfico, con modificadores, ZWJ o banderas),
// con un tope de longitud para evitar basura. El VS16 se normaliza para agrupar.
function normalizeEmoji(raw: string): string | null {
  const emoji = raw.replace(/\uFE0F/g, '')
  if (!emoji || [...emoji].length > 12) return null
  const ok =
    /^(?:\p{Extended_Pictographic}(?:\u200D\p{Extended_Pictographic})*[\u{1F3FB}-\u{1F3FF}]?\u20E3?|\p{Regional_Indicator}{2}|[#*0-9]\u20E3)$/u.test(
      emoji,
    )
  return ok ? emoji : null
}

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
  const raw = typeof body?.emoji === 'string' ? body.emoji : ''
  const emoji = normalizeEmoji(raw)
  if (!emoji) {
    return NextResponse.json({ error: 'Emoji no válido' }, { status: 400 })
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
