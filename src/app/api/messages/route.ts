// GET  /api/messages — historial (últimos 500) o incremental con ?since=ISO
// POST /api/messages — guarda un mensaje nuevo (texto o foto) y lo difunde por websocket
import { NextResponse } from 'next/server'
import { db, ensureDb } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { broadcastEvent } from '@/lib/broadcast'
import { notifyPartner } from '@/lib/push'
import { parseYoutubeId } from '@/lib/songs'
import { toPayload, withExtras, messageInclude, partnerPresence } from '@/lib/messages'

const MAX_MESSAGES = 500
const MAX_CONTENT_LENGTH = 2000
const MAX_CAPTION_LENGTH = 500
const MAX_FILE_BASE64 = 7_000_000 // ~5 MB en binario
const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const ALLOWED_AUDIO_MIMES = ['audio/webm', 'audio/mpeg', 'audio/mp4', 'audio/ogg']

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
    select: { id: true, username: true },
  })
  const presence = partner ? await partnerPresence(partner.id) : { online: false, typing: false }

  const sinceParam = new URL(req.url).searchParams.get('since')
  const since = sinceParam ? new Date(sinceParam) : null
  const validSince = since && !Number.isNaN(since.getTime()) ? since : null

  // Carga inicial: últimos 500 no borrados (con citas y reacciones)
  if (!validSince) {
    const [messages, users] = await Promise.all([
      db.message.findMany({
        where: { deletedAt: null },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: MAX_MESSAGES,
        include: messageInclude,
      }),
      db.user.findMany({
        select: { username: true, avatar: true },
      }),
    ])
    const avatars: Record<string, string | null> = {}
    for (const u of users) avatars[u.username] = u.avatar
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
      avatars,
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

  // Avatar del otro solo cuando cambia (para no reenviar ~30 KB en cada poll)
  let avatarChanged: string | null | undefined
  if (partner) {
    const row = await db.user.findUnique({
      where: { id: partner.id },
      select: { avatar: true, avatarUpdatedAt: true },
    })
    if (row?.avatarUpdatedAt && row.avatarUpdatedAt > validSince) {
      avatarChanged = row.avatar
    }
  }

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
    ...(avatarChanged !== undefined && partner
      ? { avatars: { [partner.username]: avatarChanged } }
      : {}),
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
  const audio = typeof body.audio === 'string' ? body.audio : ''
  const musicId = parseYoutubeId(typeof body.music === 'string' ? body.music : '')
  const replyToId =
    typeof body.replyToId === 'number' && Number.isInteger(body.replyToId) && body.replyToId > 0
      ? body.replyToId
      : null

  // --- Validación según el tipo de mensaje ---
  if (!image && !audio && !content && !musicId) {
    return NextResponse.json({ error: 'El mensaje está vacío' }, { status: 400 })
  }
  if ((image ? 1 : 0) + (audio ? 1 : 0) + (musicId ? 1 : 0) > 1) {
    return NextResponse.json({ error: 'Envía foto, audio o música (solo uno)' }, { status: 400 })
  }
  if (musicId && content) {
    return NextResponse.json({ error: 'La música no lleva texto' }, { status: 400 })
  }
  if (content.length > (image || audio ? MAX_CAPTION_LENGTH : MAX_CONTENT_LENGTH)) {
    return NextResponse.json({ error: 'El mensaje es demasiado largo' }, { status: 400 })
  }

  let fileData: { mime: string; data: string; size: number } | null = null
  const fileInput = image || audio
  if (fileInput) {
    const match =
      /^data:((?:image\/(?:jpeg|png|webp|gif))|(?:audio\/(?:webm|mpeg|mp4|ogg)));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
        fileInput,
      )
    if (!match) {
      return NextResponse.json(
        { error: 'Formato de archivo no válido (foto JPG/PNG/WebP/GIF o audio)' },
        { status: 400 },
      )
    }
    const mime = match[1]
    const data = match[2]
    const size = Math.floor((data.length * 3) / 4)
    if (data.length > MAX_FILE_BASE64) {
      return NextResponse.json(
        { error: 'El archivo es demasiado grande (máximo 5 MB)' },
        { status: 413 },
      )
    }
    const allowed = audio ? ALLOWED_AUDIO_MIMES : ALLOWED_IMAGE_MIMES
    if (!allowed.includes(mime)) {
      return NextResponse.json({ error: 'Tipo de archivo no permitido' }, { status: 400 })
    }
    fileData = { mime, data, size }
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

  if (musicId) {
    const inLibrary = await db.song.findUnique({
      where: { youtubeId: musicId },
      select: { id: true },
    })
    if (!inLibrary) {
      return NextResponse.json(
        { error: 'Añade primero la canción a la biblioteca' },
        { status: 400 },
      )
    }
  }

  const kind = musicId ? 'music' : audio ? 'audio' : image ? 'image' : 'text'
  const created = await db.message.create({
    data: {
      content: musicId ?? content,
      type: kind,
      userId: session.user.id,
      replyToId: replyToId ?? undefined,
      ...(fileData ? { image: { create: fileData } } : {}),
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

  // Aviso push al otro usuario (no bloquea la respuesta si falla)
  const partner = await db.user
    .findFirst({ where: { id: { not: session.user.id } }, select: { id: true } })
    .catch(() => null)
  if (partner) {
    const preview =
      created.type === 'image'
        ? `📷 ${content || 'Foto'}`
        : created.type === 'audio'
          ? '🎙️ Nota de voz'
          : created.type === 'music'
            ? `🎵 ${payload.music?.title ?? 'Música'}`
            : content.slice(0, 120)
    notifyPartner(partner.id, session.user.name, preview).catch(() => {})
  }

  return NextResponse.json({ message: payload })
}
