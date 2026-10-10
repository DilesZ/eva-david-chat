import { db } from './db'

export type MessagePayload = {
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

type MessageWithUser = {
  id: number
  content: string
  type: string
  createdAt: Date
  readAt: Date | null
  editedAt: Date | null
  user: { username: string; name: string }
}

export function toPayload(m: MessageWithUser): MessagePayload {
  return {
    id: m.id,
    content: m.content,
    type: m.type,
    createdAt: m.createdAt.toISOString(),
    imageUrl: m.type === 'image' ? `/api/images/${m.id}` : null,
    readAt: m.readAt ? m.readAt.toISOString() : null,
    editedAt: m.editedAt ? m.editedAt.toISOString() : null,
    username: m.user.username,
    name: m.user.name,
  }
}

export const messageInclude = { user: { select: { username: true, name: true } } } as const

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
