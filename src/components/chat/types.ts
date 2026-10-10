// Tipos compartidos del chat de Eva y David
export type SessionUser = {
  id: number
  username: string
  name: string
  email: string | null
}

export type Partner = {
  username: string
  name: string
}

export type ChatMessage = {
  id: number
  content: string
  type: string
  createdAt: string
  imageUrl: string | null
  audioUrl: string | null
  readAt: string | null
  editedAt: string | null
  username: string
  name: string
  replyTo: {
    id: number
    username: string
    name: string
    content: string
    type: string
  } | null
  reactions: {
    emoji: string
    count: number
    mine: boolean
    users: string[]
  }[]
}
