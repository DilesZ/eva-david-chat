// DELETE /api/songs/[id] — quita una canción de la biblioteca
import { NextResponse } from 'next/server'
import { db, ensureDb } from '@/lib/db'
import { getSession } from '@/lib/auth'

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await ensureDb()
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }
  const { id } = await params
  const songId = Number(id)
  if (!Number.isInteger(songId) || songId <= 0) {
    return NextResponse.json({ error: 'Identificador no válido' }, { status: 400 })
  }
  const song = await db.song.findUnique({ where: { id: songId } })
  if (!song) {
    return NextResponse.json({ error: 'Canción no encontrada' }, { status: 404 })
  }
  await db.song.delete({ where: { id: songId } })
  return NextResponse.json({ ok: true, id: songId })
}
