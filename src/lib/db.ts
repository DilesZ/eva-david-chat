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

// SQLite en Vercel vive en /tmp y nace vacío en cada instancia: el `db push` del
// build se pierde. Estas DDL crean el esquema bajo demanda (idempotentes).
const SCHEMA_DDL = [
  `CREATE TABLE IF NOT EXISTS "User" ("id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "username" TEXT NOT NULL, "password" TEXT NOT NULL, "name" TEXT NOT NULL, "email" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username")`,
  `CREATE TABLE IF NOT EXISTS "Message" ("id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "content" TEXT NOT NULL DEFAULT '', "type" TEXT NOT NULL DEFAULT 'text', "readAt" DATETIME, "userId" INTEGER NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE)`,
  `CREATE INDEX IF NOT EXISTS "Message_createdAt_idx" ON "Message"("createdAt")`,
  `CREATE TABLE IF NOT EXISTS "MessageImage" ("id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "mime" TEXT NOT NULL, "data" TEXT NOT NULL, "size" INTEGER NOT NULL, "messageId" INTEGER NOT NULL, CONSTRAINT "MessageImage_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "MessageImage_messageId_key" ON "MessageImage"("messageId")`,
  `CREATE TABLE IF NOT EXISTS "Session" ("id" TEXT NOT NULL PRIMARY KEY, "token" TEXT NOT NULL, "userId" INTEGER NOT NULL, "expiresAt" DATETIME NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Session_token_key" ON "Session"("token")`,
  `CREATE TABLE IF NOT EXISTS "PasswordResetToken" ("id" TEXT NOT NULL PRIMARY KEY, "codeHash" TEXT NOT NULL, "userId" INTEGER NOT NULL, "expiresAt" DATETIME NOT NULL, "usedAt" DATETIME, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE)`,
  `CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_createdAt_idx" ON "PasswordResetToken"("userId", "createdAt")`,
]

let schemaPromise: Promise<void> | null = null

export function ensureDb(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      for (const ddl of SCHEMA_DDL) {
        await db.$executeRawUnsafe(ddl)
      }
    })().catch((e) => {
      schemaPromise = null
      throw e
    })
  }
  return schemaPromise
}