// POST /api/push/subscribe — guarda la suscripción Web Push del navegador
import { handlePushSubscription } from '@/lib/push-subscription'

export async function POST(req: Request) {
  return handlePushSubscription(req, false)
}
