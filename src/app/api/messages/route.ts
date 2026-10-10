// GET  /api/messages — historial (últimos 500 mensajes en orden ascendente)
// POST /api/messages — guarda un mensaje nuevo (texto o foto) y lo difunde por websocket
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { broadcastEvent } from '@/lib/broadcast'

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
  username: string
  name: string
}

function toPayload(m: {
  id: number
  content: string
  type: string
  createdAt: Date
  readAt: Date | null
  user: { username: string; name: string }
}): BroadcastMessage {
  return {
    id: m.id,
    content: m.content,
    type: m.type,
    createdAt: m.createdAt.toISOString(),
    imageUrl: m.type === 'image' ? `/api/images/${m.id}` : null,
    readAt: m.readAt ? m.readAt.toISOString() : null,
    username: m.user.username,
    name: m.user.name,
  }
}

const messageInclude = { user: { select: { username: true, name: true } } } as const

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const messages = await db.message.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: MAX_MESSAGES,
    include: messageInclude,
  })

  return NextResponse.json({ messages: messages.reverse().map(toPayload) })
}

export async function POST(req: Request) {
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

  const created = await db.message.create({
    data: {
      content,
      type: image ? 'image' : 'text',
      userId: session.user.id,
      ...(imageData ? { image: { create: imageData } } : {}),
    },
    include: messageInclude,
  })

  const payload = toPayload(created)

  // Difunde el mensaje en tiempo real a través del servicio de websocket
  try {
    await broadcastEvent('new-message', payload)
  } catch (err) {
    // El mensaje ya está guardado; si falla la difusión el otro usuario lo verá al recargar
    console.error('[messages] no se pudo difundir por websocket:', err)
  }

  return NextResponse.json({ message: payload })
}
