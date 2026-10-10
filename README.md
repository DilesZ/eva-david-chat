# Eva ♥ David — Chat privado

Next.js 16 + Tailwind + shadcn + Prisma (Postgres en Neon) + Socket.IO.

> Estado: datos compartidos y persistentes en Postgres (Neon vía Vercel Storage).
> El tiempo real por websockets (`mini-services/chat-service`, puertos 3003/3004) solo
> funciona en local/VPS; en Vercel los mensajes se envían y leen por la API.

## Despliegue en Vercel (GitHub → Vercel)

1. Crear repo en GitHub (p. ej. `eva-david-chat`, público) y subir este código.
2. En [vercel.com](https://vercel.com) → Add New → Project → Import desde GitHub.
   - Framework: Next.js (autodetectado por `vercel.json`).
   - Build Command: `npm run vercel-build`
   - Install Command: `npm install`
3. Environment Variables (Settings → Environment Variables):
   - `DATABASE_URL=file:/tmp/custom.db`
   - `CHAT_INTERNAL_SECRET=<secreto-largo-aleatorio>`
   - `EMAIL_DEV_FALLBACK=true` (o configura `SMTP_HOST/PORT/USER/PASS/FROM` para emails reales)
4. Deploy. Cada `git push` a `main` redespliega solo.

## Local

```bash
npm install
cp .env.example .env
npx prisma db push
npx tsx scripts/seed.ts   # eva/eva123, david/david123
npm run dev               # Next en :3000
# websockets solo local/VPS:
cd mini-services/chat-service && npm install && npm run dev
```

## Scripts

- `npm run build` → build Vercel/Node estándar
- `npm run build:standalone` → build standalone + Caddy (VPS original)
- `npm run vercel-build` → `prisma generate + db push + next build`
