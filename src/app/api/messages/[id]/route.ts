// PATCH  /api/messages/[id] — edita el contenido de un mensaje propio
// DELETE /api/messages/[id] — borrado suave de un mensaje propio (se sincroniza por polling)
import { NextResponse } from 'next/server'
import { db, ensureDb } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { toPayload, messageInclude } from '@/lib/messages'

const MAX_CONTENT_LENGTH = 2000
const MAX_CAPTION_LENGTH = 500

async function ownMessage(messageId: number, userId: number) {
  return db.message.findFirst({
    where: { id: messageId, userId, deletedAt: null },
    include: messageInclude,
  })
}

export async function PATCH(
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
  const content = typeof body?.content === 'string' ? body.content.trim() : ''
  const msg = await ownMessage(messageId, session.user.id)
  if (!msg) {
    return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 })
  }
  const limit = msg.type === 'image' ? MAX_CAPTION_LENGTH : MAX_CONTENT_LENGTH
  if (!content || content.length > limit) {
    return NextResponse.json({ error: 'Contenido no válido' }, { status: 400 })
  }

  const updated = await db.message.update({
    where: { id: messageId },
    data: { content, editedAt: new Date() },
    include: messageInclude,
  })
  return NextResponse.json({ message: toPayload(updated) })
}

export async function DELETE(
  _req: Request,
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

  const msg = await ownMessage(messageId, session.user.id)
  if (!msg) {
    return NextResponse.json({ error: 'Mensaje no encontrado' }, { status: 404 })
  }

  await db.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date() },
  })
  return NextResponse.json({ ok: true, id: messageId })
}
