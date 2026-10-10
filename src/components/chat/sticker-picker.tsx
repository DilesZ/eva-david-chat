'use client'

// Pack de stickers propio: tocar envía al instante (como WhatsApp).
import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { svgStickerToPng } from './utils'

export const STICKER_PACKS: { id: string; name: string; files: string[] }[] = [
  {
    id: 'amor',
    name: 'Amor',
    files: [
      'corazon-rojo.svg',
      'corazon-rosa.svg',
      'corazon-flecha.svg',
      'globo-corazon.svg',
      'anillo.svg',
      'carta.svg',
      'flor-rosa.svg',
      'margarita.svg',
      'sol.svg',
      'arcoiris.svg',
      'luna.svg',
      'estrella.svg',
    ],
  },
]

export function StickerPicker({
  open,
  onPick,
  onClose,
  positionClassName = 'bottom-full left-0 mb-2',
}: {
  open: boolean
  onPick: (pngDataUrl: string) => void
  onClose: () => void
  positionClassName?: string
}) {
  const boxRef = useRef<HTMLDivElement | null>(null)
  const mountedAt = useRef(0)
  const [sending, setSending] = useState<string | null>(null)

  useEffect(() => {
    if (open) mountedAt.current = Date.now()
  }, [open ])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (Date.now() - mountedAt.current < 500) return
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  async function handlePick(file: string) {
    if (sending) return
    setSending(file)
    try {
      const png = await svgStickerToPng(`/stickers/amor/${file}`)
      onPick(png)
    } catch {
      // si falla la conversión, se queda en el picker
    } finally {
      setSending(null)
    }
  }

  if (!open) return null
  const pack = STICKER_PACKS[0]

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-label="Elegir sticker"
      className={`absolute ${positionClassName} z-30 w-[300px] max-w-[80vw] bg-white border border-rose-100 rounded-2xl shadow-xl p-2`}
    >
      <p className="text-xs font-semibold text-stone-500 px-1.5 pb-1.5">{pack.name} ♥</p>
      <div className="grid grid-cols-4 gap-1.5 max-h-64 overflow-y-auto">
        {pack.files.map((f) => (
          <button
            key={f}
            type="button"
            aria-label={`Enviar sticker ${f.replace('.svg', '')}`}
            onClick={() => handlePick(f)}
            disabled={sending !== null}
            className="relative aspect-square rounded-xl hover:bg-rose-50 p-1 transition"
          >
            <img
              src={`/stickers/amor/${f}`}
              alt=""
              loading="lazy"
              draggable={false}
              className="w-full h-full object-contain"
            />
            {sending === f && (
              <span className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-xl">
                <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
