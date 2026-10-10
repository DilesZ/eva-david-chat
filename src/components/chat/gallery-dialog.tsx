'use client'

// Galería: rejilla con las últimas fotos del chat. Clic para ampliar.
import { useEffect, useState } from 'react'
import { Loader2, ImageIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDayLabel } from './utils'

type Photo = { id: number; imageUrl: string; caption: string; createdAt: string }

export function GalleryDialog({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  onPick: (url: string) => void
}) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const res = await fetch('/api/gallery')
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setPhotos(Array.isArray(data.photos) ? data.photos : [])
        }
      } catch {
        // se muestra el estado vacío
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open ])

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg rounded-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-stone-800">
            <ImageIcon className="w-5 h-5 text-rose-500" />
            Nuestras fotos
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-12 text-stone-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : photos.length === 0 ? (
          <p className="text-sm text-stone-500 text-center py-12">
            Aún no hay fotos. ¡Enviad la primera!
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <button
                key={p.id}
                type="button"
                title={formatDayLabel(new Date(p.createdAt))}
                onClick={() => onPick(p.imageUrl)}
                className="relative aspect-square overflow-hidden rounded-xl group"
              >
                <img
                  src={p.imageUrl}
                  alt={p.caption || 'Foto del chat'}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
