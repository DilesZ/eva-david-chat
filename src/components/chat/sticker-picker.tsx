'use client'

// Pack de stickers propio: tocar envía al instante (como WhatsApp).
import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { svgStickerToPng } from './utils'

export const STICKER_PACKS: { id: string; name: string; files: string[] }[] = [
  {
    id: 'amor',
    name: 'Amor ♥',
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
  {
    id: 'caritas',
    name: 'Caritas ☺',
    files: [
      'enamorado.svg',
      'guino.svg',
      'risa.svg',
      'dormido.svg',
      'guay.svg',
      'fiesta.svg',
      'tarta.svg',
      'helado.svg',
      'gato.svg',
      'oso.svg',
      'fantasma.svg',
      'pollito.svg',
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
  const [error, setError] = useState('')
  const [packId, setPackId] = useState(STICKER_PACKS[0].id)
  const pack = STICKER_PACKS.find((p) => p.id === packId) ?? STICKER_PACKS[0]

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
    setError('')
    try {
      const png = await svgStickerToPng(`/stickers/${pack.id}/${file}`)
      onPick(png)
    } catch {
      setError('No se pudo enviar el sticker, prueba con otro')
    } finally {
      setSending(null)
    }
  }

  if (!open) return null

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-label="Elegir sticker"
      className={`absolute ${positionClassName} z-30 w-[300px] max-w-[80vw] bg-white border border-rose-100 rounded-2xl shadow-xl p-2`}
    >
      <div className="flex gap-1 px-1.5 pb-1.5">
        {STICKER_PACKS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPackId(p.id)}
            className={`flex-1 text-xs font-semibold rounded-full py-1.5 transition ${
              p.id === pack.id ? 'bg-rose-500 text-white' : 'bg-stone-100 text-stone-500'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>
      {error && (
        <p className="text-xs text-red-500 px-1.5 pb-1.5" role="alert">
          {error}
        </p>
      )}
      <div className="grid grid-cols-4 gap-1.5 max-h-64 overflow-y-auto">
        {pack.files.map((f) => (
          <button
            key={pack.id + f}
            type="button"
            aria-label={`Enviar sticker ${f.replace('.svg', '')}`}
            onClick={() => handlePick(f)}
            disabled={sending !== null}
            className="relative aspect-square rounded-xl hover:bg-rose-50 p-1 transition"
          >
            <img
              src={`/stickers/${pack.id}/${f}`}
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
