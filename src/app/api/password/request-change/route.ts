// POST /api/password/request-change — envía un código de verificación al correo
// del usuario conectado para permitirle cambiar su contraseña
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { createVerificationCode } from '@/lib/verification'
import { isEmailConfigured, isDevFallbackEnabled, sendVerificationCode, maskEmail } from '@/lib/email'

export async function POST() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } })
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  if (!user.email) {
    return NextResponse.json(
      { error: 'Primero guarda tu correo electrónico en Ajustes' },
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
    if (isEmailConfigured()) {
      return NextResponse.json(
        { error: 'No se pudo enviar el correo. Revisa la configuración del servidor.' },
        { status: 502 },
      )
    }
    if (isDevFallbackEnabled()) {
      // Sin SMTP y con EMAIL_DEV_FALLBACK=true: el código se muestra en pantalla
      // para poder probar el flujo mientras no haya correo configurado.
      return NextResponse.json({
        ok: true,
        dev: true,
        devCode: result.code,
        maskedEmail: maskEmail(user.email),
      })
    }
    return NextResponse.json(
      { error: 'El envío de correos no está configurado en el servidor todavía.' },
      { status: 503 },
    )
  }

  return NextResponse.json({ ok: true, maskedEmail: maskEmail(user.email) })
}
