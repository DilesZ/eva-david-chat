'use client'

// Buscador de GIFs (Giphy): tendencias + búsqueda, clic para elegir.
// Requiere NEXT_PUBLIC_GIPHY_KEY (gratis en developers.giphy.com).
import { useEffect, useRef, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

const GIPHY_KEY = process.env.NEXT_PUBLIC_GIPHY_KEY ?? ''

type Gif = { id: string; thumb: string; full: string; title: string }

type GiphyItem = {
  id: string
  title?: string
  images?: {
    fixed_height_small?: { url?: string }
    original?: { url?: string }
  }
}

async function fetchGifs(path: string): Promise<Gif[]> {
  const res = await fetch(path)
  if (!res.ok) throw new Error('Giphy no responde')
  const data = await res.json()
  return ((data.data ?? []) as GiphyItem[]).map((g) => ({
    id: String(g.id),
    thumb: g.images?.fixed_height_small?.url ?? g.images?.original?.url ?? '',
    full: g.images?.original?.url ?? '',
    title: String(g.title ?? 'GIF'),
  })).filter((g) => g.thumb && g.full)
}

export function GifPicker({
  open,
  onPick,
  onClose,
}: {
  open: boolean
  onPick: (dataUrl: string) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const [gifs, setGifs] = useState<Gif[]>([])
  const [loading, setLoading] = useState(false)
  const [converting, setConverting] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement | null>(null)
  const debounceRef = useRef<number | null>(null)

  useEffect(() => {
    if (!open || !GIPHY_KEY) return
    let cancelled = false
    setLoading(true)
    fetchGifs(
      `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_KEY}&limit=12&rating=g`,
    )
      .then((list) => {
        if (!cancelled) setGifs(list)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open ])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
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

  function handleQuery(value: string) {
    setQuery(value)
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    if (!GIPHY_KEY || value.trim().length < 2) return
    debounceRef.current = window.setTimeout(async () => {
      setLoading(true)
      try {
        const list = await fetchGifs(
          `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_KEY}&q=${encodeURIComponent(value.trim())}&limit=12&rating=g`,
        )
        setGifs(list)
      } catch {
        // se mantiene la lista anterior
      } finally {
        setLoading(false)
      }
    }, 400)
  }

  async function handlePick(gif: Gif) {
    if (converting) return
    setConverting(gif.id)
    try {
      const blob = await (await fetch(gif.full)).blob()
      if (blob.size > 5 * 1024 * 1024) {
        setConverting(null)
        return
      }
      const dataUrl: string = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('fail'))
        reader.readAsDataURL(blob)
      })
      onPick(dataUrl)
    } catch {
      // si falla la descarga, se queda en el picker
    } finally {
      setConverting(null)
    }
  }

  if (!open) return null

  return (
    <div
      ref={boxRef}
      role="dialog"
      aria-label="Elegir GIF"
      className="absolute bottom-full left-0 mb-2 w-[300px] max-w-[80vw] bg-white border border-rose-100 rounded-2xl shadow-xl p-2 z-30"
    >
      {!GIPHY_KEY ? (
        <p className="text-xs text-stone-500 px-2 py-3 text-center">
          Configura <b>NEXT_PUBLIC_GIPHY_KEY</b> para activar los GIFs.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-1.5 px-1 pb-2">
            <Search className="w-4 h-4 text-stone-400 shrink-0" />
            <Input
              autoFocus
              placeholder="Buscar GIFs…"
              value={query}
              onChange={(e) => handleQuery(e.target.value)}
              className="h-9 border-rose-200 focus-visible:ring-rose-300"
            />
          </div>
          {loading && gifs.length === 0 ? (
            <div className="flex justify-center py-8 text-stone-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5 max-h-64 overflow-y-auto">
              {gifs.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  title={g.title}
                  onClick={() => handlePick(g)}
                  disabled={converting !== null}
                  className="relative aspect-square overflow-hidden rounded-lg bg-rose-50 group"
                >
                  <img
                    src={g.thumb}
                    alt={g.title}
                    loading="lazy"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  {converting === g.id && (
                    <span className="absolute inset-0 flex items-center justify-center bg-white/60">
                      <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
          <p className="text-[10px] text-stone-300 text-center pt-1.5">GIFs por GIPHY</p>
        </>
      )}
    </div>
  )
}
