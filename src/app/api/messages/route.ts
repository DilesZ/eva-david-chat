// GET  /api/messages — historial (últimos 500) o incremental con ?since=ISO
// POST /api/messages — guarda un mensaje nuevo (texto o foto) y lo difunde por websocket
import { NextResponse } from 'next/server'
import { db, ensureDb } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { broadcastEvent } from '@/lib/broadcast'
import { toPayload, withExtras, messageInclude, partnerPresence } from '@/lib/messages'

const MAX_MESSAGES = 500
const MAX_CONTENT_LENGTH = 2000
const MAX_CAPTION_LENGTH = 500
const MAX_IMAGE_BASE64 = 7_000_000 // ~5 MB en binario
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export type BroadcastMessage = {
  id: number
  content: string
  type: string
  createdAt: string
  imageUrl: string | null
  readAt: string | null
  editedAt: string | null
  username: string
  name: string
}

export async function GET(req: Request) {
  await ensureDb()
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Latido de presencia en cada poll
  await db.user.update({
    where: { id: session.user.id },
    data: { lastSeenAt: new Date() },
  }).catch(() => {})

  const partner = await db.user.findFirst({
    where: { id: { not: session.user.id } },
    select: { id: true },
  })
  const presence = partner ? await partnerPresence(partner.id) : { online: false, typing: false }

  const sinceParam = new URL(req.url).searchParams.get('since')
  const since = sinceParam ? new Date(sinceParam) : null
  const validSince = since && !Number.isNaN(since.getTime()) ? since : null

  // Carga inicial: últimos 500 no borrados (con citas y reacciones)
  if (!validSince) {
    const messages = await db.message.findMany({
      where: { deletedAt: null },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_MESSAGES,
      include: messageInclude,
    })
    const payloads = await withExtras(
      messages.reverse().map(toPayload),
      session.user.username,
    )
    return NextResponse.json({
      messages: payloads,
      edited: [],
      deletedIds: [],
      readIds: [],
      reactionSync: [],
      partner: presence,
    })
  }

  // Poll incremental: nuevos + editados + borrados + leídos + reacciones desde `since`
  const [fresh, edited, deleted, read, touched] = await Promise.all([
    db.message.findMany({
      where: { deletedAt: null, createdAt: { gt: validSince } },
      orderBy: [{ id: 'asc' }],
      take: MAX_MESSAGES,
      include: messageInclude,
    }),
    db.message.findMany({
      where: { deletedAt: null, editedAt: { gt: validSince } },
      orderBy: [{ id: 'asc' }],
      take: MAX_MESSAGES,
      include: messageInclude,
    }),
    db.message.findMany({
      where: { deletedAt: { gt: validSince } },
      select: { id: true },
      take: MAX_MESSAGES,
    }),
    db.message.findMany({
      where: { userId: session.user.id, readAt: { gt: validSince } },
      select: { id: true },
      take: MAX_MESSAGES,
    }),
    db.message.findMany({
      where: { deletedAt: null, reactionsUpdatedAt: { gt: validSince } },
      orderBy: [{ id: 'asc' }],
      take: MAX_MESSAGES,
      include: messageInclude,
    }),
  ])

  const freshIds = new Set(fresh.map((m) => m.id))
  const editedIds = new Set(edited.map((m) => m.id))
  const onlyTouched = touched.filter((m) => !freshIds.has(m.id) && !editedIds.has(m.id))

  return NextResponse.json({
    messages: await withExtras(
      fresh.map(toPayload),
      session.user.username,
    ),
    edited: await withExtras(
      edited.map(toPayload),
      session.user.username,
    ),
    deletedIds: deleted.map((m) => m.id),
    readIds: read.map((m) => m.id),
    reactionSync: await withExtras(
      onlyTouched.map(toPayload),
      session.user.username,
    ),
    partner: presence,
  })
}

export async function POST(req: Request) {
  await ensureDb()
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Petición inválida' }, { status: 400 })
  }

  const content = typeof body.content === 'string' ? body.content.trim() : ''
  const image = typeof body.image === 'string' ? body.image : ''
  const replyToId =
    typeof body.replyToId === 'number' && Number.isInteger(body.replyToId) && body.replyToId > 0
      ? body.replyToId
      : null

  // --- Validación según el tipo de mensaje ---
  if (!image && !content) {
    return NextResponse.json({ error: 'El mensaje está vacío' }, { status: 400 })
  }
  if (content.length > (image ? MAX_CAPTION_LENGTH : MAX_CONTENT_LENGTH)) {
    return NextResponse.json({ error: 'El mensaje es demasiado largo' }, { status: 400 })
  }

  let imageData: { mime: string; data: string; size: number } | null = null
  if (image) {
    const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(image)
    if (!match) {
      return NextResponse.json(
        { error: 'Formato de imagen no válido (usa JPG, PNG, WebP o GIF)' },
        { status: 400 },
      )
    }
    const mime = match[1]
    const data = match[2]
    const size = Math.floor((data.length * 3) / 4)
    if (data.length > MAX_IMAGE_BASE64) {
      return NextResponse.json({ error: 'La foto es demasiado grande (máximo 5 MB)' }, { status: 413 })
    }
    if (!ALLOWED_MIMES.includes(mime)) {
      return NextResponse.json({ error: 'Tipo de imagen no permitido' }, { status: 400 })
    }
    imageData = { mime, data, size }
  }

  if (replyToId) {
    const parent = await db.message.findFirst({
      where: { id: replyToId, deletedAt: null },
      select: { id: true },
    })
    if (!parent) {
      return NextResponse.json({ error: 'El mensaje citado ya no existe' }, { status: 400 })
    }
  }

  const created = await db.message.create({
    data: {
      content,
      type: image ? 'image' : 'text',
      userId: session.user.id,
      replyToId: replyToId ?? undefined,
      ...(imageData ? { image: { create: imageData } } : {}),
    },
    include: messageInclude,
  })

  const [payload] = await withExtras([toPayload(created)], session.user.username)

  // Difunde el mensaje en tiempo real a través del servicio de websocket
  try {
    await broadcastEvent('new-message', payload)
  } catch (err) {
    // El mensaje ya está guardado; si falla la difusión el otro usuario lo verá al recargar
    console.error('[messages] no se pudo difundir por websocket:', err)
  }

  return NextResponse.json({ message: payload })
}
