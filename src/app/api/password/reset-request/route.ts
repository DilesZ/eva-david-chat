// POST /api/password/reset-request — "¿Has olvidado tu contraseña?" desde el login.
// Envía un código de verificación al correo guardado de ese usuario.
// Requiere SMTP configurado (no hay modo de prueba aquí por seguridad).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createVerificationCode } from '@/lib/verification'
import { isEmailConfigured, sendVerificationCode, maskEmail } from '@/lib/email'

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const username = typeof body?.username === 'string' ? body.username.trim().toLowerCase() : ''

  if (!username) {
    return NextResponse.json({ error: 'Escribe tu usuario' }, { status: 400 })
  }
  if (!isEmailConfigured()) {
    return NextResponse.json(
      { error: 'El envío de correos no está configurado en el servidor todavía. Pide ayuda para cambiar la contraseña.' },
      { status: 503 },
    )
  }

  const user = await db.user.findUnique({ where: { username } })
  if (!user) {
    return NextResponse.json({ error: 'No existe ese usuario' }, { status: 404 })
  }
  if (!user.email) {
    return NextResponse.json(
      { error: 'Este usuario todavía no tiene un correo guardado. Inicia sesión y configúralo en Ajustes.' },
      { status: 400 },
    )
  }

  const result = await createVerificationCode(user.id)
  if (!result.ok) {
    return NextResponse.json(
      { error: 'Has pedido demasiados códigos. Espera unos minutos e inténtalo de nuevo.' },
      { status: 429 },
    )
  }

  const sent = await sendVerificationCode(user.email, user.name, result.code)
  if (!sent) {
    return NextResponse.json(
      { error: 'No se pudo enviar el correo. Inténtalo de nuevo en unos minutos.' },
      { status: 502 },
    )
  }

  return NextResponse.json({ ok: true, maskedEmail: maskEmail(user.email) })
}
