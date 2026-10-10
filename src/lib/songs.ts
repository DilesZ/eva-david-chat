import { db } from './db'

// Extrae el ID de 11 caracteres de un vídeo de YouTube (watch, shorts, embed, youtu.be)
export function parseYoutubeId(input: string): string | null {
  const url = input.trim()
  const patterns = [
    /(?:youtube\.com\/watch\?.*v=|youtube\.com\/shorts\/|youtube\.com\/embed\/|youtube\.com\/live\/)([A-Za-z0-9_-]{11})/,
    /youtu\.be\/([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ]
  for (const re of patterns) {
    const m = re.exec(url)
    if (m) return m[1]
  }
  return null
}

export type SongInfo = {
  youtubeId: string
  title: string
  artist: string
  thumbnail: string
}

// Metadatos vía oEmbed (gratis, sin clave). Si falla, usa valores por defecto.
export async function fetchSongInfo(youtubeId: string): Promise<SongInfo> {
  const fallback: SongInfo = {
    youtubeId,
    title: 'Vídeo de YouTube',
    artist: '',
    thumbnail: `https://i.ytimg.com/vi/${youtubeId}/hqdefault.jpg`,
  }
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${youtubeId}`)}&format=json`,
      { signal: AbortSignal.timeout(8000) },
    )
    if (!res.ok) return fallback
    const data = await res.json().catch(() => null)
    if (!data || typeof data.title !== 'string') return fallback
    return {
      youtubeId,
      title: String(data.title).slice(0, 200),
      artist: typeof data.author_name === 'string' ? String(data.author_name).slice(0, 200) : '',
      thumbnail:
        typeof data.thumbnail_url === 'string' && data.thumbnail_url
          ? data.thumbnail_url
          : fallback.thumbnail,
    }
  } catch {
    return fallback
  }
}

export async function getOrCreateSong(youtubeId: string, userId: number) {
  const existing = await db.song.findUnique({
    where: { youtubeId },
    include: { addedBy: { select: { username: true, name: true } } },
  })
  if (existing) return { song: existing, created: false }
  const info = await fetchSongInfo(youtubeId)
  const song = await db.song.create({
    data: {
      youtubeId,
      title: info.title,
      artist: info.artist,
      thumbnail: info.thumbnail,
      addedById: userId,
    },
    include: { addedBy: { select: { username: true, name: true } } },
  })
  return { song, created: true }
}
