// POST /api/password/confirm-change — verifica el código recibido por correo
// y cambia la contraseña del usuario conectado (cierra sus otras sesiones)
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db, ensureDb } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { verifyAndConsumeCode } from '@/lib/verification'

const MIN_PASSWORD = 6
const MAX_PASSWORD = 100

export async function POST(req: Request) {
  await ensureDb()
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : ''

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'El código debe tener 6 dígitos' }, { status: 400 })
  }
  if (newPassword.length < MIN_PASSWORD || newPassword.length > MAX_PASSWORD) {
    return NextResponse.json(
      { error: `La nueva contraseña debe tener entre ${MIN_PASSWORD} y ${MAX_PASSWORD} caracteres` },
      { status: 400 },
    )
  }

  const verified = await verifyAndConsumeCode(session.user.id, code)
  if (!verified.ok) {
    return NextResponse.json(
      { error: 'Código incorrecto o caducado. Pide uno nuevo.' },
      { status: 400 },
    )
  }

  const hashed = await bcrypt.hash(newPassword, 10)

  // Transacción: cambia la contraseña y cierra las demás sesiones por seguridad
  await db.$transaction([
    db.user.update({ where: { id: session.user.id }, data: { password: hashed } }),
    db.session.deleteMany({
      where: { userId: session.user.id, id: { not: session.sessionId } },
    }),
  ])

  return NextResponse.json({ ok: true })
}
