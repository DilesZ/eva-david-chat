// POST /api/push/unsubscribe — elimina la suscripción Web Push del navegador
import { handlePushSubscription } from '@/lib/push-subscription'

export async function POST(req: Request) {
  return handlePushSubscription(req, true)
}
