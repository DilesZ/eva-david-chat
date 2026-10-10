// Utilidades de sesión para el chat de Eva y David
import { cookies } from 'next/headers'
import crypto from 'crypto'
import { db } from '@/lib/db'

export const SESSION_COOKIE = 'ed_session'
const SESSION_DAYS = 30

export type SessionUserInfo = {
  id: number
  username: string
  name: string
  email: string | null
}

type ValidSession = {
  sessionId: string
  token: string
  user: SessionUserInfo
}

export async function createSession(userId: number): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomUUID() + crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await db.session.create({ data: { token, userId, expiresAt } })
  return { token, expiresAt }
}

export function sessionCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds,
  }
}

// Devuelve la sesión válida a partir de la cookie, o null si no existe / caducó
export async function getSession(): Promise<ValidSession | null> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await db.session.findUnique({
    where: { token },
    include: { user: { select: { id: true, username: true, name: true, email: true } } },
  })
  if (!session) return null

  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }

  return {
    sessionId: session.id,
    token: session.token,
    user: {
      id: session.user.id,
      username: session.user.username,
      name: session.user.name,
      email: session.user.email,
    },
  }
}
