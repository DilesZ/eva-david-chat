'use client'

// Biblioteca de música: añadir URLs de YouTube y compartirlas en el chat.
import { useEffect, useState } from 'react'
import { Loader2, Music, Plus, Send, Trash2, Youtube } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export type Song = {
  id: number
  youtubeId: string
  title: string
  artist: string
  thumbnail: string
}

export function MusicDialog({
  open,
  onClose,
  onShare,
}: {
  open: boolean
  onClose: () => void
  onShare: (youtubeId: string, title: string) => void
}) {
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(false)
  const [url, setUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [sharingId, setSharingId] = useState<number | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError('')
    ;(async () => {
      try {
        const res = await fetch('/api/songs')
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) setSongs(Array.isArray(data.songs) ? data.songs : [])
        }
      } catch {
        // estado vacío
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [open ])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim() || adding) return
    setAdding(true)
    setError('')
    try {
      const res = await fetch('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.song) {
        setError(data?.error ?? 'No se pudo añadir la canción')
        return
      }
      setSongs((prev) =>
        prev.some((s) => s.id === data.song.id) ? prev : [data.song, ...prev],
      )
      setUrl('')
    } catch {
      setError('Error de conexión, inténtalo de nuevo')
    } finally {
      setAdding(false)
    }
  }

  async function handleDelete(id: number) {
    try {
      const res = await fetch(`/api/songs/${id}`, { method: 'DELETE' })
      if (res.ok) setSongs((prev) => prev.filter((s) => s.id !== id))
    } catch {
      // se mantiene en la lista
    }
  }

  async function handleShare(song: Song) {
    if (sharingId) return
    setSharingId(song.id)
    try {
      await onShare(song.youtubeId, song.title)
    } finally {
      setSharingId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-stone-800">
            <Music className="w-5 h-5 text-rose-500" />
            Nuestra música
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleAdd} className="flex gap-2">
          <Input
            placeholder="Pega un enlace de YouTube…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={adding}
            inputMode="url"
            className="h-10 border-rose-200 focus-visible:ring-rose-300"
          />
          <Button
            type="submit"
            disabled={adding || !url.trim()}
            className="h-10 rounded-full bg-rose-500 hover:bg-rose-600 text-white shrink-0"
          >
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span className="hidden sm:inline">Añadir</span>
          </Button>
        </form>
        {error && (
          <p className="text-xs text-red-500" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-10 text-stone-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : songs.length === 0 ? (
          <div className="flex flex-col items-center py-10 gap-2 text-stone-400">
            <Youtube className="w-10 h-10 text-rose-200" />
            <p className="text-sm">Aún no hay canciones. ¡Añadid la primera!</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {songs.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 bg-stone-50 border border-stone-100 rounded-2xl p-2"
              >
                <a
                  href={`https://www.youtube.com/watch?v=${s.youtubeId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="shrink-0"
                >
                  <img
                    src={s.thumbnail}
                    alt=""
                    loading="lazy"
                    className="w-20 aspect-video object-cover rounded-xl"
                  />
                </a>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-stone-800 truncate">{s.title}</p>
                  {s.artist && (
                    <p className="text-[11px] text-stone-400 truncate">{s.artist}</p>
                  )}
                </div>
                <Button
                  type="button"
                  size="icon"
                  onClick={() => handleShare(s)}
                  disabled={sharingId !== null}
                  aria-label={`Compartir ${s.title}`}
                  title="Compartir en el chat"
                  className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white"
                >
                  {sharingId === s.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => handleDelete(s.id)}
                  aria-label="Quitar de la biblioteca"
                  className="p-1.5 rounded-full text-stone-300 hover:text-red-500 hover:bg-red-50 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
