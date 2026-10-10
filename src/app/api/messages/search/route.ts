// GET /api/messages/search?q= — busca en el contenido de los mensajes (no borrados)
import { NextResponse } from 'next/server'
import { db, ensureDb } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { withExtras, toPayload, messageInclude } from '@/lib/messages'

export async function GET(req: Request) {
  await ensureDb()
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const q = (new URL(req.url).searchParams.get('q') ?? '').trim().slice(0, 100)
  if (q.length < 2) {
    return NextResponse.json({ messages: [] })
  }

  const messages = await db.message.findMany({
    where: { deletedAt: null, content: { contains: q, mode: 'insensitive' } },
    orderBy: [{ id: 'desc' }],
    take: 30,
    include: messageInclude,
  })

  return NextResponse.json({
    messages: await withExtras(
      messages.map(toPayload),
      session.user.username,
    ),
  })
}
