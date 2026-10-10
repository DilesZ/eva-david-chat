import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

// Postgres compartido (Neon): el esquema lo crea `prisma db push` en el build.
// ensureDb se conserva como no-op para no tocar los 12 call sites de la API.
export function ensureDb(): Promise<void> {
  return Promise.resolve()
}