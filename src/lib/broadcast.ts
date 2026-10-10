// Cliente para el endpoint interno de difusión del servicio de websocket
// (mini-services/chat-service, servidor HTTP interno en 127.0.0.1:3004)
const INTERNAL_URL = process.env.CHAT_INTERNAL_URL ?? 'http://127.0.0.1:3004/broadcast'

// Difunde un evento a todos los clientes conectados. El servicio emite
// `event` con `payload`; si no hay secreto configurado falla rápido.
export async function broadcastEvent(event: string, payload: unknown): Promise<void> {
  const secret = process.env.CHAT_INTERNAL_SECRET ?? ''
  if (!secret) throw new Error('CHAT_INTERNAL_SECRET no configurado')

  const res = await fetch(INTERNAL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-internal-secret': secret,
    },
    body: JSON.stringify({ event, payload }),
    signal: AbortSignal.timeout(3000),
  })
  if (!res.ok) {
    throw new Error(`El servicio de websocket respondió ${res.status}`)
  }
}
