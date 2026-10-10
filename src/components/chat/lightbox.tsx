'use client'

// Visor de fotos a pantalla completa (lightbox)
import { X } from 'lucide-react'
import { useEffect } from 'react'

export function Lightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 cursor-zoom-out"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Foto ampliada"
    >
      <button
        type="button"
        onClick={onClose}
        autoFocus
        aria-label="Cerrar foto"
        className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center"
      >
        <X className="w-6 h-6" />
      </button>
      <img
        src={url}
        alt="Foto ampliada"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] max-w-full rounded-xl shadow-2xl cursor-default"
      />
    </div>
  )
}
