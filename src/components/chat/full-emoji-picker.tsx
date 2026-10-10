'use client'

// Selector completo de emojis (miles, con buscador y categorías, estilo WhatsApp).
// Los datos (~1 MB) se cargan bajo demanda la primera vez que se abre.
import { useEffect, useRef, useState, type ComponentType } from 'react'
import { Loader2 } from 'lucide-react'

export function FullEmojiPicker({
  open,
  onPick,
  onClose,
  positionClassName = 'bottom-full left-0 mb-2',
}: {
  open: boolean
  onPick: (emoji: string) => void
  onClose: () => void
  positionClassName?: string
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [Picker, setPicker] = useState<ComponentType<any> | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [data, setData] = useState<any>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const mountedAt = useRef(0)

  useEffect(() => {
    if (open) mountedAt.current = Date.now()
  }, [open ])

  useEffect(() => {
    if (!open || Picker) return
    let cancelled = false
    ;(async () => {
      try {
        const [pickerMod, dataMod] = await Promise.all([
          import('@emoji-mart/react'),
          import('@emoji-mart/data'),
        ])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const PickerComp = (pickerMod as any).default ?? pickerMod
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const emojiData = (dataMod as any).default ?? dataMod
        if (!cancelled) {
          setPicker(() => PickerComp)
          setData(emojiData)
        }
      } catch {
        // se muestra el spinner hasta que cargue
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open, Picker])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      // Ignora el mousedown fantasma del propio toque que abrió el picker
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

  if (!open) return null

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-label="Elegir emoji"
      className={`absolute ${positionClassName} z-30 rounded-2xl overflow-hidden shadow-xl border border-rose-100 max-w-[86vw]`}
    >
      {Picker && data ? (
        <Picker
          data={data}
          onEmojiSelect={(e: { native?: string }) => {
            if (e?.native) onPick(e.native)
          }}
          theme="light"
          set="native"
          previewPosition="none"
          searchPosition="sticky"
          skinTonePosition="search"
          perLine={8}
          maxFrequentRows={2}
        />
      ) : (
        <div className="w-[320px] max-w-[86vw] h-[380px] bg-white flex items-center justify-center text-stone-400">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}
    </div>
  )
}
