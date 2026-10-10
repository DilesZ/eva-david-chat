import webpush from 'web-push'
import { db } from './db'

let configured = false

function setup() {
  if (configured) return true
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:localhost'
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? ''
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? ''
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(subject, publicKey, privateKey)
  configured = true
  return true
}

export function isPushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

// Avisan al otro usuario de un mensaje nuevo. Nunca lanza: los fallos
// de push no pueden romper el envío, y las suscripciones muertas se podan.
export async function notifyPartner(
  partnerId: number,
  title: string,
  body: string,
): Promise<void> {
  if (!setup()) return
  const subs = await db.pushSubscription
    .findMany({ where: { userId: partnerId } })
    .catch(() => [])
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ title, body, url: '/' }),
        )
      } catch (err) {
        const code = (err as { statusCode?: number })?.statusCode
        if (code === 404 || code === 410) {
          await db.pushSubscription.delete({ where: { id: s.id } }).catch(() => {})
        }
      }
    }),
  )
}
