'use client'

// Selector rápido de emojis para el mensaje
import { useEffect, useRef } from 'react'

const EMOJIS = [
  '😊', '😍', '❤️', '😘', '🥰', '😄', '😂', '😉',
  '😎', '🤗', '😴', '😢', '😭', '😡', '🤦', '🤷',
  '👍', '👏', '🙏', '💪', '💯', '🎉', '🌹', '💋',
  '🔥', '☕', '🍕', '🍺', '⚽', '🌙', '⭐', '🌈',
  '🌸', '💕', '💍', '🏠', '✈️', '🎁', '📚', '🎵',
]

export function EmojiPicker({
  open,
  onPick,
  onClose,
}: {
  open: boolean
  onPick: (emoji: string) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
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
      ref={ref}
      className="absolute bottom-full right-0 mb-2 w-[280px] bg-white border border-rose-100 rounded-2xl shadow-xl p-2.5 z-20"
      role="dialog"
      aria-label="Emojis"
    >
      <div className="grid grid-cols-8 gap-0.5">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            tabIndex={0}
            aria-label={`Insertar ${emoji}`}
            onClick={() => onPick(emoji)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-xl hover:bg-rose-50 active:scale-110 transition"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
