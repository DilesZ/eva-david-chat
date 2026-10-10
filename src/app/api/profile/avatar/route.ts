// POST /api/profile/avatar — guarda (o quita con {image:null}) la foto de perfil.
// Acepta dataURL de imagen pequeña (el cliente la comprime a 256px antes de enviar).
import { NextResponse } from 'next/server'
import { db, ensureDb } from '@/lib/db'
import { getSession } from '@/lib/auth'

const MAX_AVATAR_BASE64 = 700_000 // ~500 KB en binario
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export async function POST(req: Request) {
  await ensureDb()
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const image = typeof body?.image === 'string' ? body.image : ''

  if (!image) {
    await db.user.update({
      where: { id: session.user.id },
      data: { avatar: null, avatarUpdatedAt: new Date() },
    })
    return NextResponse.json({ ok: true, avatar: null })
  }

  const match = /^data:(image\/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/]+={0,2})$/.exec(image)
  if (!match || !ALLOWED_MIMES.includes(match[1]) || match[2].length > MAX_AVATAR_BASE64) {
    return NextResponse.json({ error: 'Foto no válida (JPG/PNG/WebP/GIF pequeña)' }, { status: 400 })
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { avatar: image, avatarUpdatedAt: new Date() },
  })
  return NextResponse.json({ ok: true, avatar: image })
}
