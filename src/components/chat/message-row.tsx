'use client'

// Burbuja de mensaje: texto y/o foto, cita respondida, reacciones con emoji,
// hora, marcas de enviado/visto (✓ / ✓✓), etiqueta "editado",
// y acciones de responder/editar/borrar.
import { useRef, useState } from 'react'
import { Check, CheckCheck, Pencil, Trash2, Reply, SmilePlus, Copy, X, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { ChatMessage } from './types'
import { styleFor, formatTime } from './utils'
import { FullEmojiPicker } from './full-emoji-picker'

export function MessageRow({
  msg,
  own,
  avatarImg,
  onImageClick,
  onEdit,
  onDelete,
  onReply,
  onReact,
  onJumpTo,
  highlighted,
}: {
  msg: ChatMessage
  own: boolean
  avatarImg?: string | null
  onImageClick: (url: string) => void
  onEdit?: (id: number, content: string) => Promise<boolean>
  onDelete?: (id: number) => void
  onReply?: (msg: ChatMessage) => void
  onReact?: (id: number, emoji: string) => void
  onJumpTo?: (id: number) => void
  highlighted?: boolean
}) {
  const style = styleFor(msg.username)
  const read = !!msg.readAt
  const edited = !!msg.editedAt
  const hasImage = msg.type === 'image' && !!msg.imageUrl
  const hasAudio = msg.type === 'audio' && !!msg.audioUrl
  const hasMusic = msg.type === 'music' && !!msg.music
  const hasSticker = msg.type === 'sticker' && !!msg.imageUrl
  const [playingMusic, setPlayingMusic] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(msg.content)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [reactOpen, setReactOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const pressTimer = useRef<number | null>(null)
  const pressStart = useRef<{ x: number; y: number } | null>(null)
  const longPressed = useRef(false)

  function clearPressTimer() {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current)
      pressTimer.current = null
    }
  }

  // Solo elementos interactivos (imagen, botones, audio...) gestionan su propio toque
  function isInteractiveTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null
    return !!el?.closest?.('img,button,a,textarea,audio,input')
  }

  function handleTouchStart(e: React.TouchEvent) {
    if (editing || isInteractiveTarget(e.target)) return
    const t = e.touches[0]
    pressStart.current = { x: t.clientX, y: t.clientY }
    longPressed.current = false
    clearPressTimer()
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true
      try {
        navigator.vibrate?.(15)
      } catch {
        // sin vibración
      }
      setReactOpen(false)
      setSheetOpen(true)
    }, 500)
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!pressStart.current) return
    const t = e.touches[0]
    const dx = t.clientX - pressStart.current.x
    const dy = t.clientY - pressStart.current.y
    if (dx * dx + dy * dy > 100) {
      // es scroll, no pulsación
      clearPressTimer()
      pressStart.current = null
    }
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const wasPress = !!pressStart.current
    clearPressTimer()
    pressStart.current = null
    if (!wasPress || longPressed.current || editing || isInteractiveTarget(e.target)) return
    // Toque rápido: abre/cierra el picker de reacciones.
    // preventDefault evita el mousedown "fantasma" que el navegador emite
    // tras el touchend y que cerraría el picker al instante.
    e.preventDefault()
    setSheetOpen(false)
    setReactOpen((v) => !v)
  }

  async function handleCopy() {
    if (!msg.content) return
    try {
      await navigator.clipboard.writeText(msg.content)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = msg.content
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
    setSheetOpen(false)
  }

  async function handleSaveEdit() {
    if (!onEdit || saving) return
    const text = editText.trim()
    if (!text || text === msg.content) {
      setEditing(false)
      setEditText(msg.content)
      return
    }
    setSaving(true)
    const ok = await onEdit(msg.id, text)
    setSaving(false)
    if (ok) setEditing(false)
  }

  const reactions = Array.isArray(msg.reactions) ? msg.reactions : []

  return (
    <div
      data-message-id={msg.id}
      className={`group relative flex items-end gap-2 ${own ? 'flex-row-reverse justify-start' : ''} ${
        highlighted ? 'rounded-2xl ring-2 ring-amber-400 bg-amber-50/60 -m-1 p-1' : ''
      }`}
    >
      {onReact && (
        <FullEmojiPicker
          open={reactOpen}
          onClose={() => setReactOpen(false)}
          onPick={(emoji) => {
            onReact(msg.id, emoji)
            setReactOpen(false)
          }}
          positionClassName={`bottom-full mb-1 ${own ? 'right-0' : 'left-0'}`}
        />
      )}
      <div
        className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm overflow-hidden ${style.avatar}`}
        aria-hidden="true"
      >
        {avatarImg ? (
          <img src={avatarImg} alt="" className="w-full h-full object-cover" />
        ) : (
          msg.name.charAt(0).toUpperCase()
        )}
      </div>
      <div
        className={`flex flex-col max-w-[75%] sm:max-w-[70%] ${own ? 'items-end' : 'items-start'}`}
      >
        {!own && (
          <span className={`text-[11px] font-semibold mb-0.5 px-1 ${style.label}`}>{msg.name}</span>
        )}
        {hasSticker ? (
          <img
            src={msg.imageUrl ?? ''}
            alt="Sticker"
            loading="lazy"
            draggable={false}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onContextMenu={(e) => e.preventDefault()}
            onClick={() => onImageClick(msg.imageUrl as string)}
            className="block w-36 sm:w-44 h-auto object-contain cursor-zoom-in drop-shadow select-none"
          />
        ) : (
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onContextMenu={(e) => e.preventDefault()}
            className={`rounded-2xl shadow-sm ${style.bubble} ${
              hasImage ? 'p-1.5' : 'px-4 py-2.5'
            } ${own ? 'rounded-br-md' : 'rounded-bl-md'} select-none`}
          >
          {msg.replyTo && (
            <button
              type="button"
              onClick={() => onJumpTo?.(msg.replyTo!.id)}
              title={`Ir al mensaje de ${msg.replyTo.name}`}
              className="block w-full text-left mb-1.5 rounded-lg bg-black/10 hover:bg-black/15 px-2.5 py-1.5 transition"
            >
              <span className={`block text-[11px] font-semibold ${own ? '' : style.label}`}>
                {msg.replyTo.name}
              </span>
              <span className="block text-[12px] leading-snug truncate opacity-90">
                {msg.replyTo.type === 'image'
                  ? '📷 Foto'
                  : msg.replyTo.type === 'audio'
                    ? '🎙️ Audio'
                    : msg.replyTo.type === 'music'
                      ? '🎵 Música'
                      : msg.replyTo.type === 'sticker'
                        ? '✨ Sticker'
                        : msg.replyTo.content}
              </span>
            </button>
          )}
          {hasMusic && msg.music && (
            <div className="w-[220px] sm:w-[260px] max-w-full">
              {playingMusic ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${msg.music.youtubeId}?autoplay=1&rel=0`}
                  title={msg.music.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="block w-full aspect-video rounded-xl bg-black"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setPlayingMusic(true)}
                  aria-label={`Reproducir ${msg.music.title}`}
                  className="relative block w-full group/play"
                >
                  <img
                    src={msg.music.thumbnail}
                    alt={msg.music.title}
                    loading="lazy"
                    className="block w-full aspect-video object-cover rounded-xl"
                  />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="w-12 h-12 rounded-full bg-black/60 group-hover/play:bg-rose-500 flex items-center justify-center transition">
                      <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                    </span>
                  </span>
                </button>
              )}
              <p className="text-[13px] font-semibold leading-snug pt-1.5 px-1 line-clamp-2">
                {msg.music.title}
              </p>
              {msg.music.artist && (
                <p className="text-[11px] opacity-75 px-1 truncate">{msg.music.artist}</p>
              )}
            </div>
          )}
          {hasImage && (
            <img
              src={msg.imageUrl ?? ''}
              alt={msg.content || 'Foto enviada'}
              loading="lazy"
              onClick={() => onImageClick(msg.imageUrl as string)}
              className={`block max-w-[220px] sm:max-w-[300px] max-h-[320px] w-auto object-cover cursor-zoom-in ${
                msg.content ? 'rounded-xl' : 'rounded-[14px]'
              }`}
            />
          )}
          {hasAudio && (
            <audio
              src={msg.audioUrl ?? ''}
              controls
              preload="metadata"
              className="block w-[220px] sm:w-[260px] max-w-full my-1"
            />
          )}
          {editing ? (
            <div className="min-w-[200px] space-y-2 bg-white rounded-xl p-2">
              <Textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={2}
                maxLength={msg.type === 'text' ? 2000 : 500}
                autoFocus
                className="text-sm text-stone-800 resize-none"
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={saving}
                  onClick={() => {
                    setEditing(false)
                    setEditText(msg.content)
                  }}
                  className="h-7 text-xs text-stone-500"
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={saving || !editText.trim()}
                  onClick={handleSaveEdit}
                  className="h-7 text-xs bg-rose-500 hover:bg-rose-600 text-white"
                >
                  {saving ? 'Guardando…' : 'Guardar'}
                </Button>
              </div>
            </div>
          ) : (
            msg.content && (
              <p
                className={`text-[15px] leading-snug whitespace-pre-wrap break-words ${
                  hasImage ? 'px-2.5 pt-1.5 pb-0.5' : ''
                }`}
              >
                {msg.content}
              </p>
            )
          )}
          </div>
        )}

        {reactions.length > 0 && (
          <div className={`flex flex-wrap items-center gap-1 mt-1 ${own ? 'justify-end' : ''}`}>
            {reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                title={r.users.join(', ')}
                onClick={() => onReact?.(msg.id, r.emoji)}
                className={`flex items-center gap-0.5 text-[13px] leading-none px-2 py-1 rounded-full border shadow-sm transition ${
                  r.mine
                    ? 'bg-rose-100 border-rose-300'
                    : 'bg-white border-stone-200 hover:border-rose-200'
                }`}
              >
                <span>{r.emoji}</span>
                <span className="text-[11px] font-semibold text-stone-500">{r.count}</span>
              </button>
            ))}
          </div>
        )}

        <span
          className={`text-[10px] text-stone-400 mt-0.5 px-1 flex items-center gap-1 ${
            own ? 'flex-row-reverse' : ''
          }`}
        >
          {formatTime(new Date(msg.createdAt))}
          {copied && <span className="text-emerald-500 font-semibold">· ¡copiado!</span>}
          {edited && <span className="italic">· editado</span>}
          {own &&
            (read ? (
              <CheckCheck className="w-3.5 h-3.5 text-sky-500" aria-label="Visto" />
            ) : (
              <Check className="w-3.5 h-3.5 text-stone-300" aria-label="Enviado" />
            ))}
          {onReply && (
            <button
              type="button"
              aria-label="Responder citando"
              title="Responder"
              onClick={() => onReply(msg)}
              className="p-1 rounded-full opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-stone-200/70 text-stone-400 hover:text-stone-600 transition"
            >
              <Reply className="w-3 h-3" />
            </button>
          )}
          {onReact && (
            <button
              type="button"
              aria-label="Añadir reacción"
              title="Reaccionar"
              onClick={() => setReactOpen((v) => !v)}
              className="p-1 rounded-full opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-stone-200/70 text-stone-400 hover:text-rose-500 transition"
            >
              <SmilePlus className="w-3 h-3" />
            </button>
          )}
          {own && !editing && (onEdit || onDelete) && (
            <span className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              {onEdit && (
                <button
                  type="button"
                  aria-label="Editar mensaje"
                  title="Editar"
                  onClick={() => {
                    setEditText(msg.content)
                    setEditing(true)
                  }}
                  className="p-1 rounded-full hover:bg-stone-200/70 text-stone-400 hover:text-stone-600"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  aria-label="Borrar mensaje"
                  title="Borrar"
                  onClick={() => setConfirmDelete(true)}
                  className="p-1 rounded-full hover:bg-red-100 text-stone-400 hover:text-red-500"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </span>
          )}
        </span>
      </div>

      {sheetOpen && (
        <>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={() => setSheetOpen(false)}
            className="fixed inset-0 z-40 cursor-default bg-black/40"
          />
          <div
            role="dialog"
            aria-label="Opciones del mensaje"
            className="fixed bottom-0 inset-x-0 z-50 bg-white rounded-t-3xl shadow-2xl p-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] animate-in slide-in-from-bottom"
          >
            <div className="w-10 h-1 rounded-full bg-stone-200 mx-auto my-2" aria-hidden="true" />
            {onReply && (
              <button
                type="button"
                onClick={() => {
                  setSheetOpen(false)
                  onReply(msg)
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-rose-50 text-[15px] text-stone-700"
              >
                <Reply className="w-5 h-5 text-rose-500" /> Responder
              </button>
            )}
            {msg.content && (
              <button
                type="button"
                onClick={handleCopy}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-rose-50 text-[15px] text-stone-700"
              >
                <Copy className="w-5 h-5 text-rose-500" /> Copiar texto
              </button>
            )}
            {own && onEdit && (
              <button
                type="button"
                onClick={() => {
                  setSheetOpen(false)
                  setEditText(msg.content)
                  setEditing(true)
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-rose-50 text-[15px] text-stone-700"
              >
                <Pencil className="w-5 h-5 text-rose-500" /> Editar
              </button>
            )}
            {own && onDelete && (
              <button
                type="button"
                onClick={() => {
                  setSheetOpen(false)
                  setConfirmDelete(true)
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-red-50 text-[15px] text-red-500"
              >
                <Trash2 className="w-5 h-5" /> Borrar
              </button>
            )}
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl hover:bg-stone-100 text-[15px] text-stone-500"
            >
              <X className="w-5 h-5" /> Cancelar
            </button>
          </div>
        </>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar este mensaje?</AlertDialogTitle>
            <AlertDialogDescription>
              Desaparecerá para los dos. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-full bg-red-500 hover:bg-red-600"
              onClick={() => onDelete?.(msg.id)}
            >
              Borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
