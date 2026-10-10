// POST /api/profile/email — guarda el correo electrónico del usuario conectado
// (necesario para poder verificar el cambio de contraseña por correo)
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MAX_EMAIL = 254

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''

  if (!email || !EMAIL_RE.test(email) || email.length > MAX_EMAIL) {
    return NextResponse.json({ error: 'Escribe un correo electrónico válido' }, { status: 400 })
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { email },
  })

  return NextResponse.json({ ok: true, email })
}
