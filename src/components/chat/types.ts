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
  readAt: string | null
  editedAt: string | null
  username: string
  name: string
}
