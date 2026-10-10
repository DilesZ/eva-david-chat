// POST /api/password/reset-confirm — segundo paso de "¿Has olvidado tu contraseña?":
// verifica el código recibido por correo y establece la nueva contraseña.
// Cierra TODAS las sesiones del usuario (se volverá a identificar en todos sus dispositivos).
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db, ensureDb } from '@/lib/db'
import { verifyAndConsumeCode } from '@/lib/verification'

const MIN_PASSWORD = 6
const MAX_PASSWORD = 100

export async function POST(req: Request) {
  await ensureDb()
  const body = await req.json().catch(() => null)
  const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : ''
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

  if (!username) {
    return NextResponse.json({ error: 'Falta el usuario' }, { status: 400 })
  }
  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'El código debe tener 6 dígitos' }, { status: 400 })
  }
  if (newPassword.length < MIN_PASSWORD || newPassword.length > MAX_PASSWORD) {
    return NextResponse.json(
      { error: `La nueva contraseña debe tener entre ${MIN_PASSWORD} y ${MAX_PASSWORD} caracteres` },
      { status: 400 },
    )
  }

  const user = await db.user.findUnique({ where: { username } })
  if (!user) {
    return NextResponse.json({ error: 'No existe ese usuario' }, { status: 404 })
  }

  const verified = await verifyAndConsumeCode(user.id, code)
  if (!verified.ok) {
    return NextResponse.json(
      { error: 'Código incorrecto o caducado. Pide uno nuevo.' },
      { status: 400 },
    )
  }

  const hashed = await bcrypt.hash(newPassword, 10)

  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { password: hashed } }),
    db.session.deleteMany({ where: { userId: user.id } }),
  ])

  return NextResponse.json({ ok: true })
}
