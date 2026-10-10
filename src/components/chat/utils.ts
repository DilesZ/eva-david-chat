// Utilidades del chat: fechas, estilos por autor, compresión de fotos y sonido
import type { ChatMessage } from './types'

export const BASE_TITLE = 'Eva ♥ David'

// ---- estilos por autor ----

export const authorStyles: Record<string, { bubble: string; avatar: string; label: string }> = {
  eva: {
    bubble: 'bg-rose-500 text-white',
    avatar: 'bg-gradient-to-br from-rose-400 to-pink-500',
    label: 'text-rose-500',
  },
  david: {
    bubble: 'bg-emerald-500 text-white',
    avatar: 'bg-gradient-to-br from-emerald-400 to-teal-500',
    label: 'text-emerald-600',
  },
}

export const fallbackStyle = {
  bubble: 'bg-stone-600 text-white',
  avatar: 'bg-stone-400',
  label: 'text-stone-500',
}

export function styleFor(username: string) {
  return authorStyles[username] ?? fallbackStyle
}

// ---- fechas (es-ES) ----

export function dayKey(d: Date): number {
  return d.getFullYear() * 10000 + d.getMonth() * 100 + d.getDate()
}

export function formatDayLabel(d: Date): string {
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const that = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((today.getTime() - that.getTime()) / 86400000)
  if (diffDays === 0) return 'Hoy'
  if (diffDays === 1) return 'Ayer'
  const s = new Intl.DateTimeFormat('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d)
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function formatTime(d: Date): string {
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(d)
}

// "últ. vez hoy 14:32" / "últ. vez ayer 09:10" / "últ. vez 3 de octubre"
export function formatLastSeen(d: Date): string {
  if (Number.isNaN(d.getTime())) return 'Desconectado'
  const now = new Date()
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dayDiff = Math.round((startOf(now) - startOf(d)) / 86_400_000)
  if (dayDiff <= 0) return `últ. vez hoy ${formatTime(d)}`
  if (dayDiff === 1) return `últ. vez ayer ${formatTime(d)}`
  const s = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long' }).format(d)
  return `últ. vez ${s}`
}

// valida la forma de un mensaje antes de pintarlo (protección frente a datos corruptos)
export function isValidMessage(m: unknown): m is ChatMessage {
  const msg = m as ChatMessage | null
  return (
    !!msg &&
    typeof msg.id === 'number' &&
    typeof msg.content === 'string' &&
    typeof msg.type === 'string' &&
    typeof msg.createdAt === 'string' &&
    typeof msg.username === 'string' &&
    !Number.isNaN(new Date(msg.createdAt).getTime())
  )
}

// ---- compresión de fotos en el navegador ----

const MAX_DIMENSION = 1600
const MAX_DATAURL_LENGTH = 6_900_000 // por debajo del límite del servidor (~7M)

function readAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(file)
  })
}

function drawScaled(bitmap: ImageBitmap, w: number, h: number, whiteBg: boolean): string {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas no disponible')
  if (whiteBg) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(bitmap, 0, 0, w, h)
  return canvas.toDataURL('image/jpeg', 0.85)
}

// Reduce la foto (máx. 1600px, JPEG 85%) para que pese poco antes de enviarla.
// Los GIF se dejan tal cual para conservar la animación.
export async function compressImage(file: File): Promise<string> {
  if (file.size > 15 * 1024 * 1024) {
    throw new Error('La foto es demasiado grande (máximo 15 MB)')
  }
  if (file.type === 'image/gif') {
    return await readAsDataURL(file)
  }
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))

    // PNG con transparencia se mantiene en PNG; si pesa demasiado se pasa a JPEG
    if (file.type === 'image/png') {
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas no disponible')
      ctx.drawImage(bitmap, 0, 0, w, h)
      const png = canvas.toDataURL('image/png')
      if (png.length <= MAX_DATAURL_LENGTH) return png
    }

    let out = drawScaled(bitmap, w, h, false)
    if (out.length > MAX_DATAURL_LENGTH) {
      const scale2 = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height))
      out = drawScaled(
        bitmap,
        Math.max(1, Math.round(bitmap.width * scale2)),
        Math.max(1, Math.round(bitmap.height * scale2)),
        true,
      )
    }
    return out
  } finally {
    bitmap.close()
  }
}

// Foto de perfil: cuadrada de 256px en JPEG (~20-40 KB) para guardar en la BD
export async function compressAvatar(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Elige una imagen (JPG, PNG, WebP o GIF)')
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('La foto es demasiado grande (máximo 10 MB)')
  }
  const bitmap = await createImageBitmap(file)
  try {
    const side = Math.min(bitmap.width, bitmap.height)
    const sx = Math.floor((bitmap.width - side) / 2)
    const sy = Math.floor((bitmap.height - side) / 2)
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas no disponible')
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, 256, 256)
    return canvas.toDataURL('image/jpeg', 0.82)
  } finally {
    bitmap.close()
  }
}

// ---- aviso sonoro suave (sin archivos externos) ----

export function playPing(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.value = 740
    gain.gain.setValueAtTime(0.05, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.3)
    osc.onended = () => ctx.close().catch(() => {})
  } catch {
    // el sonido es optativo: si el navegador lo bloquea, no pasa nada
  }
}
