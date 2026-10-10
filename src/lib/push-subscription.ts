import { NextResponse } from 'next/server'
import { db, ensureDb } from '@/lib/db'
import { getSession } from '@/lib/auth'

type PushKeys = { p256dh?: unknown; auth?: unknown }

export async function handlePushSubscription(req: Request, remove: boolean) {
  await ensureDb()
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const endpoint = typeof body?.endpoint === 'string' ? body.endpoint : ''
  if (!endpoint.startsWith('https://') || endpoint.length > 1000) {
    return NextResponse.json({ error: 'Suscripción no válida' }, { status: 400 })
  }

  if (remove) {
    await db.pushSubscription
      .deleteMany({ where: { endpoint, userId: session.user.id } })
      .catch(() => {})
    return NextResponse.json({ ok: true })
  }

  const keys = (body?.keys ?? {}) as PushKeys
  const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh : ''
  const auth = typeof keys.auth === 'string' ? keys.auth : ''
  if (!p256dh || !auth || p256dh.length > 300 || auth.length > 100) {
    return NextResponse.json({ error: 'Suscripción no válida' }, { status: 400 })
  }

  await db.pushSubscription.upsert({
    where: { endpoint },
    update: { p256dh, auth, userId: session.user.id },
    create: { endpoint, p256dh, auth, userId: session.user.id },
  })
  return NextResponse.json({ ok: true })
}
