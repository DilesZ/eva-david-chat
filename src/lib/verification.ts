// Códigos de verificación de 6 dígitos para cambiar la contraseña por correo.
// - Se generan aleatoriamente y se guardan como hash SHA-256 (nunca en claro)
// - Caducan a los 10 minutos y solo pueden usarse una vez
// - Máximo 5 códigos por usuario cada 15 minutos (anti abuso)
import crypto from 'crypto'
import { db } from '@/lib/db'

const CODE_TTL_MS = 10 * 60 * 1000
const MAX_CODES_PER_WINDOW = 5
const WINDOW_MS = 15 * 60 * 1000

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex')
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return crypto.timingSafeEqual(ba, bb)
}

export type CreateCodeResult =
  | { ok: true; code: string }
  | { ok: false; error: 'rate_limited' }

// Crea un código para el usuario y lo devuelve en claro (para enviarlo por correo)
export async function createVerificationCode(
  userId: number,
): Promise<CreateCodeResult> {
  const recent = await db.passwordResetToken.count({
    where: { userId, createdAt: { gt: new Date(Date.now() - WINDOW_MS) } },
  })
  if (recent >= MAX_CODES_PER_WINDOW) {
    return { ok: false, error: 'rate_limited' }
  }

  // 6 dígitos criptográficamente aleatorios (100000-999999)
  const code = String(100000 + (crypto.randomBytes(4).readUInt32BE(0) % 900000))
  await db.passwordResetToken.create({
    data: {
      codeHash: hashCode(code),
      userId,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    },
  })
  return { ok: true, code }
}

export type VerifyResult =
  | { ok: true; tokenId: string }
  | { ok: false; error: 'invalid' }

// Verifica el código del usuario; si es correcto lo marca como usado
export async function verifyAndConsumeCode(
  userId: number,
  code: string,
): Promise<VerifyResult> {
  const token = await db.passwordResetToken.findFirst({
    where: {
      userId,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!token) return { ok: false, error: 'invalid' }

  if (!safeEqual(token.codeHash, hashCode(code))) {
    return { ok: false, error: 'invalid' }
  }

  await db.passwordResetToken.update({
    where: { id: token.id },
    data: { usedAt: new Date() },
  })
  return { ok: true, tokenId: token.id }
}

// Limpia códigos caducados o usados de más de un día (mantenimiento básico)
export async function pruneOldCodes(): Promise<void> {
  await db.passwordResetToken
    .deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { usedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
        ],
      },
    })
    .catch(() => {})
}
