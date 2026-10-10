import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db, ensureDb } from '@/lib/db'

// POST /api/setup — crea los usuarios iniciales SOLO si la BD está vacía.
// Necesario en Vercel: el SQLite de /tmp nace vacío en cada despliegue y no hay
// forma de ejecutar scripts contra él. Una vez con usuarios, responde 409 y no hace nada.
export async function POST() {
  await ensureDb()
  const count = await db.user.count()
  if (count > 0) {
    return NextResponse.json({ ok: false, reason: 'already-seeded' }, { status: 409 })
  }
  await db.user.create({
    data: { username: 'eva', password: await bcrypt.hash('eva123', 10), name: 'Eva' },
  })
  await db.user.create({
    data: { username: 'david', password: await bcrypt.hash('david123', 10), name: 'David' },
  })
  return NextResponse.json({ ok: true })
}
