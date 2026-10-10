// Limpieza puntual: borra TODOS los mensajes (y sus fotos) de la base de datos.
// El usuario pidió eliminar los mensajes de ejemplo; el chat empieza vacío.
// Uso: bun run scripts/clear-messages.ts
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const images = await db.messageImage.deleteMany()
  const messages = await db.message.deleteMany()
  const tokens = await db.passwordResetToken.deleteMany()
  console.log(
    `Limpieza completada: ${messages.count} mensajes, ${images.count} fotos y ${tokens.count} códigos de verificación eliminados`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
