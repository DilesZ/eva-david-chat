// Servicio de WebSocket para el chat de Eva y David
// - Verifica la sesión de cada cliente contra la API de Next.js antes de permitir la conexión
// - Recibe eventos guardados por la API y los difunde en tiempo real
// - Presencia: quién está conectado ('presence-state')
// - "Escribiendo...": retransmite 'typing' del cliente como 'user-typing' al resto
import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { Server, type Socket } from 'socket.io'

const PORT = 3003
const INTERNAL_PORT = 3004 // endpoint interno de difusión, separado del servidor de socket.io
const INTERNAL_SECRET = process.env.CHAT_INTERNAL_SECRET ?? ''
const NEXT_APP_URL = process.env.NEXT_APP_URL ?? 'http://127.0.0.1:3000'

interface SessionUser {
  id: number
  username: string
  name: string
}

// --- Servidor HTTP interno (difusión de eventos guardados por la API) ---
// Va en un puerto propio: socket.io con path '/' intercepta cualquier ruta
// del httpServer principal, así que el endpoint interno no puede vivir ahí.

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => resolve(body))
  })
}

const internalServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method === 'POST' && req.url === '/broadcast') {
    if (!INTERNAL_SECRET || req.headers['x-internal-secret'] !== INTERNAL_SECRET) {
      res.writeHead(403)
      res.end('forbidden')
      return
    }
    try {
      const body = await readBody(req)
      const parsed = JSON.parse(body)
      // {event, payload}; por compatibilidad, si solo llega el payload se asume 'new-message'
      const event = typeof parsed?.event === 'string' && parsed.event ? parsed.event : 'new-message'
      const payload = parsed?.event ? parsed.payload : parsed
      io.emit(event, payload)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('{"ok":true}')
      console.log(`[chat] difundido evento '${event}'`)
    } catch {
      res.writeHead(400)
      res.end('bad request')
    }
    return
  }
  res.writeHead(404)
  res.end()
})

internalServer.listen(INTERNAL_PORT, '127.0.0.1', () => {
  console.log(`[chat] endpoint interno de difusión en 127.0.0.1:${INTERNAL_PORT}`)
})

// --- Socket.io ---

// Servidor HTTP principal: solo atiende el websocket de socket.io
// (NO cambiar el path: Caddy lo usa para redirigir al puerto correcto)
const httpServer = createServer()

const io = new Server(httpServer, {
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// --- Presencia ---

// username -> ids de socket conectados (permite varios dispositivos)
const online = new Map<string, Set<string>>()

function onlineUsernames(): string[] {
  return [...online.keys()]
}

function broadcastPresenceState(): void {
  io.emit('presence-state', { online: onlineUsernames() })
}

function addToOnline(username: string, socketId: string): void {
  const set = online.get(username) ?? new Set<string>()
  set.add(socketId)
  online.set(username, set)
}

function removeFromOnline(username: string, socketId: string): boolean {
  const set = online.get(username)
  if (!set) return false
  set.delete(socketId)
  if (set.size === 0) {
    online.delete(username)
    return true // se quedó sin dispositivos: pasó a desconectado
  }
  return false
}

async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const res = await fetch(`${NEXT_APP_URL}/api/me`, {
      headers: { Cookie: `ed_session=${encodeURIComponent(token)}` },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.user?.username) return null
    return { id: data.user.id, username: data.user.username, name: data.user.name }
  } catch {
    return null
  }
}

// Middleware de autenticación: solo conectan sesiones válidas
io.use(async (socket: Socket, next) => {
  const token = socket.handshake.auth?.token
  if (!token || typeof token !== 'string') {
    return next(new Error('unauthorized'))
  }
  const user = await verifyToken(token)
  if (!user) {
    return next(new Error('unauthorized'))
  }
  socket.data.user = user
  next()
})

io.on('connection', (socket: Socket) => {
  const user = socket.data.user as SessionUser | undefined
  if (!user) return
  console.log(`[chat] conectado: ${user.username} (${socket.id})`)

  addToOnline(user.username, socket.id)
  // El recién llegado recibe el estado actual; el resto, la lista actualizada
  socket.emit('presence-state', { online: onlineUsernames() })
  socket.broadcast.emit('user-online', { username: user.username })
  broadcastPresenceState()

  // --- "Escribiendo..." ---
  socket.on('typing', (data: unknown) => {
    const typing = !!(data as { typing?: boolean })?.typing
    socket.broadcast.emit('user-typing', { username: user.username, typing })
  })

  socket.on('disconnect', () => {
    console.log(`[chat] desconectado: ${socket.data.user?.username ?? socket.id}`)
    const wentOffline = removeFromOnline(user.username, socket.id)
    if (wentOffline) {
      socket.broadcast.emit('user-offline', { username: user.username })
    }
    broadcastPresenceState()
  })

  socket.on('error', (err) => {
    console.error(`[chat] error socket ${socket.id}:`, err.message)
  })
})

httpServer.listen(PORT, () => {
  console.log(`[chat] servicio websocket escuchando en el puerto ${PORT}`)
})

process.on('SIGTERM', () => {
  console.log('[chat] SIGTERM recibido, cerrando...')
  httpServer.close(() => process.exit(0))
})

process.on('SIGINT', () => {
  console.log('[chat] SIGINT recibido, cerrando...')
  httpServer.close(() => process.exit(0))
})
