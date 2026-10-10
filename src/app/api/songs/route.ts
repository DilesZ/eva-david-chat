// GET  /api/songs — biblioteca de canciones favoritas
// POST /api/songs {url} — añade una canción de YouTube (por URL o ID)
import { NextResponse } from 'next/server'
import { db, ensureDb } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { parseYoutubeId, getOrCreateSong } from '@/lib/songs'

function toPayload(s: {
  id: number
  youtubeId: string
  title: string
  artist: string
  thumbnail: string
  createdAt: Date
  addedBy: { username: string; name: string }
}) {
  return {
    id: s.id,
    youtubeId: s.youtubeId,
    title: s.title,
    artist: s.artist,
    thumbnail: s.thumbnail,
    addedBy: s.addedBy.name,
    createdAt: s.createdAt.toISOString(),
  }
}

export async function GET() {
  await ensureDb()
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  const songs = await db.song.findMany({
    orderBy: [{ id: 'desc' }],
    take: 200,
    include: { addedBy: { select: { username: true, name: true } } },
  })
  return NextResponse.json({ songs: songs.map(toPayload) })
}

export async function POST(req: Request) {
  await ensureDb()
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  const body = await req.json().catch(() => null)
  const url = typeof body?.url === 'string' ? body.url : ''
  const youtubeId = parseYoutubeId(url)
  if (!youtubeId) {
    return NextResponse.json({ error: 'Pega un enlace válido de YouTube' }, { status: 400 })
  }
  const { song, created } = await getOrCreateSong(youtubeId, session.user.id)
  return NextResponse.json({ song: toPayload(song), created })
}
