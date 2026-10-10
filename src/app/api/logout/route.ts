// POST /api/logout — cierra la sesión actual
import { NextResponse } from 'next/server'
import { db, ensureDb } from '@/lib/db'
import { getSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth'

export async function POST() {
  await ensureDb()
  const session = await getSession()
  if (session) {
    await db.session.delete({ where: { id: session.sessionId } }).catch(() => {})
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, '', sessionCookieOptions(0))
  return res
}
