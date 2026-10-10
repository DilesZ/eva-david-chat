// Semilla idempotente: garantiza que existen los usuarios Eva y David.
// NUNCA toca los mensajes (solo se crean desde el chat real).
// Uso: bun run scripts/seed.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  // Solo se asigna contraseña si el usuario no existe aún (nunca se sobreescribe)
  const evaExists = await db.user.findUnique({ where: { username: 'eva' } })
  const davidExists = await db.user.findUnique({ where: { username: 'david' } })

  const eva = await db.user.upsert({
    where: { username: 'eva' },
    update: {},
    create: { username: 'eva', password: await bcrypt.hash('eva123', 10), name: 'Eva' },
  })

  const david = await db.user.upsert({
    where: { username: 'david' },
    update: {},
    create: { username: 'david', password: await bcrypt.hash('david123', 10), name: 'David' },
  })

  console.log(`Usuarios listos: ${eva.username} (id ${eva.id}), ${david.username} (id ${david.id})`)
  console.log(`(eva existía: ${!!evaExists}, david existía: ${!!davidExists})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
