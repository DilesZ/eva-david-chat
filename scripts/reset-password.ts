// Utilidad de administración: restablece la contraseña de un usuario al valor indicado.
// Uso: bun run scripts/reset-password.ts <usuario> <nuevaContraseña>
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  const [, , username, password] = process.argv
  if (!username || !password || password.length < 6) {
    console.error('Uso: bun run scripts/reset-password.ts <usuario> <nuevaContraseña (mín. 6)>')
    process.exit(1)
  }
  const user = await db.user.findUnique({ where: { username: username.toLowerCase() } })
  if (!user) {
    console.error(`No existe el usuario "${username}"`)
    process.exit(1)
  }
  const hashed = await bcrypt.hash(password, 10)
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { password: hashed } }),
    db.session.deleteMany({ where: { userId: user.id } }),
  ])
  console.log(`Contraseña de "${username}" restablecida. Sesiones cerradas.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
