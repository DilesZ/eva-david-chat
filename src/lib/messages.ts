import { db } from './db'
import type { ChatMessage } from '@/components/chat/types'

export type MessagePayload = ChatMessage

type MessageWithUser = {
  id: number
  content: string
  type: string
  createdAt: Date
  readAt: Date | null
  editedAt: Date | null
  replyToId: number | null
  user: { username: string; name: string }
}

export function toPayload(m: MessageWithUser): MessagePayload {
  const mediaUrl =
    m.type === 'image' || m.type === 'audio' || m.type === 'sticker' ? `/api/images/${m.id}` : null
  return {
    id: m.id,
    content: m.content,
    type: m.type,
    createdAt: m.createdAt.toISOString(),
    imageUrl: m.type === 'image' || m.type === 'sticker' ? mediaUrl : null,
    audioUrl: m.type === 'audio' ? mediaUrl : null,
    readAt: m.readAt ? m.readAt.toISOString() : null,
    editedAt: m.editedAt ? m.editedAt.toISOString() : null,
    username: m.user.username,
    name: m.user.name,
    replyTo: null,
    music: null,
    reactions: [],
  }
}

export const messageInclude = {
  user: { select: { username: true, name: true } },
} as const

type ReactionRow = {
  messageId: number
  emoji: string
  user: { username: string; name: string }
}

// Añade citas y reacciones a una lista de payloads (una sola ronda de consultas)
export async function withExtras(
  payloads: MessagePayload[],
  meUsername: string,
): Promise<MessagePayload[]> {
  if (payloads.length === 0) return payloads
  const ids = payloads.map((p) => p.id)

  const [reactions, parents, songs] = await Promise.all([
    db.reaction.findMany({
      where: { messageId: { in: ids } },
      select: { messageId: true, emoji: true, user: { select: { username: true, name: true } } },
      orderBy: [{ id: 'asc' }],
    }) as Promise<ReactionRow[]>,
    db.message.findMany({
      where: { id: { in: payloads.map((p) => p.id) } },
      select: {
        id: true,
        replyTo: {
          select: {
            id: true,
            content: true,
            type: true,
            user: { select: { username: true, name: true } },
          },
        },
      },
    }),
    db.song.findMany({
      where: {
        youtubeId: {
          in: payloads.filter((p) => p.type === 'music').map((p) => p.content),
        },
      },
      select: { youtubeId: true, title: true, artist: true, thumbnail: true },
    }),
  ])

  const songById = new Map(songs.map((s) => [s.youtubeId, s]))

  const parentById = new Map<
    number,
    { id: number; content: string; type: string; username: string; name: string } | null
  >()
  for (const row of parents as unknown as {
    id: number
    replyTo: {
      id: number
      content: string
      type: string
      user: { username: string; name: string }
    } | null
  }[]) {
    parentById.set(
      row.id,
      row.replyTo
        ? {
            id: row.replyTo.id,
            content: row.replyTo.content,
            type: row.replyTo.type,
            username: row.replyTo.user.username,
            name: row.replyTo.user.name,
          }
        : null,
    )
  }

  const reactionsByMessage = new Map<number, ChatMessage['reactions']>()
  for (const r of reactions) {
    const list = reactionsByMessage.get(r.messageId) ?? []
    const existing = list.find((x) => x.emoji === r.emoji)
    if (existing) {
      existing.count += 1
      existing.users.push(r.user.name)
      if (r.user.username === meUsername) existing.mine = true
    } else {
      list.push({
        emoji: r.emoji,
        count: 1,
        mine: r.user.username === meUsername,
        users: [r.user.name],
      })
    }
    reactionsByMessage.set(r.messageId, list)
  }

  return payloads.map((p) => ({
    ...p,
    replyTo: parentById.get(p.id) ?? null,
    music:
      p.type === 'music'
        ? (songById.get(p.content) ?? {
            youtubeId: p.content,
            title: 'Vídeo de YouTube',
            artist: '',
            thumbnail: `https://i.ytimg.com/vi/${p.content}/hqdefault.jpg`,
          })
        : null,
    reactions: reactionsByMessage.get(p.id) ?? [],
  }))
}

// Ventanas de presencia (ver README de polling en page.tsx)
export const ONLINE_WINDOW_MS = 35_000
export const TYPING_WINDOW_MS = 6_000

export async function partnerPresence(partnerId: number) {
  const partner = await db.user.findUnique({
    where: { id: partnerId },
    select: { lastSeenAt: true, typingAt: true },
  })
  const now = Date.now()
  return {
    online: !!partner?.lastSeenAt && now - partner.lastSeenAt.getTime() < ONLINE_WINDOW_MS,
    typing: !!partner?.typingAt && now - partner.typingAt.getTime() < TYPING_WINDOW_MS,
  }
}

// Emojis permitidos para reaccionar (conjunto común, sin VS16)
export const REACTION_EMOJIS = [
  '❤',
  '😂',
  '😮',
  '😢',
  '😍',
  '😡',
  '👍',
  '👏',
  '🙏',
  '🎉',
  '🔥',
  '😴',
] as const
