// GET /api/gallery — últimas fotos del chat para la vista de galería
import { NextResponse } from 'next/server'
import { db, ensureDb } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function GET() {
  await ensureDb()
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const photos = await db.message.findMany({
    where: { type: 'image', deletedAt: null },
    orderBy: [{ id: 'desc' }],
    take: 60,
    select: { id: true, createdAt: true, content: true },
  })

  return NextResponse.json({
    photos: photos.map((p) => ({
      id: p.id,
      imageUrl: `/api/images/${p.id}`,
      caption: p.content,
      createdAt: p.createdAt.toISOString(),
    })),
  })
}
