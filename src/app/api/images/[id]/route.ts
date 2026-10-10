// GET /api/images/[id] — sirve la foto de un mensaje (protegido por sesión)
import { NextResponse } from 'next/server'
import { db, ensureDb } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureDb()
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const { id } = await params
  const messageId = Number(id)
  if (!Number.isInteger(messageId) || messageId <= 0) {
    return NextResponse.json({ error: 'Identificador no válido' }, { status: 400 })
  }

  const image = await db.messageImage.findUnique({
    where: { messageId },
    select: { mime: true, data: true },
  })
  if (!image) {
    return NextResponse.json({ error: 'Imagen no encontrada' }, { status: 404 })
  }

  const buffer = Buffer.from(image.data, 'base64')
  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': image.mime,
      'Content-Length': String(buffer.length),
      // Las fotos no cambian nunca: caché privada agresiva
      'Cache-Control': 'private, max-age=31536000, immutable',
    },
  })
}
