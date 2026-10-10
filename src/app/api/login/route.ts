// POST /api/login — valida usuario y contraseña, crea sesión
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db, ensureDb } from '@/lib/db'
import { createSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth'

export async function POST(req: Request) {
  await ensureDb()
  try {
    const body = await req.json().catch(() => null)
    const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Escribe tu usuario y contraseña' },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({ where: { username } })
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return NextResponse.json(
        { error: 'Usuario o contraseña incorrectos' },
        { status: 401 }
      )
    }

    const { token } = await createSession(user.id)

    const partner = await db.user.findFirst({
      where: { id: { not: user.id } },
      select: { username: true, name: true, lastSeenAt: true, avatar: true },
    })

    const res = NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
      token,
      partner: partner
        ? {
            username: partner.username,
            name: partner.name,
            lastSeenAt: partner.lastSeenAt ? partner.lastSeenAt.toISOString() : null,
            avatar: partner.avatar,
          }
        : null,
    })
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(60 * 60 * 24 * 30))
    return res
  } catch (err) {
    console.error('[login] error:', err)
    return NextResponse.json({ error: 'Error interno, inténtalo de nuevo' }, { status: 500 })
  }
}
