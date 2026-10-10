'use client'

// Burbuja de mensaje: texto y/o foto, hora, marcas de enviado/visto (✓ / ✓✓),
// etiqueta "editado", y acciones de editar/borrar en mensajes propios.
import { useState } from 'react'
import { Check, CheckCheck, Pencil, Trash2 } from 'lucide-react'
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

export function MessageRow({
  msg,
  own,
  onImageClick,
  onEdit,
  onDelete,
  highlighted,
}: {
  msg: ChatMessage
  own: boolean
  onImageClick: (url: string) => void
  onEdit?: (id: number, content: string) => Promise<boolean>
  onDelete?: (id: number) => void
  highlighted?: boolean
}) {
  const style = styleFor(msg.username)
  const read = !!msg.readAt
  const edited = !!msg.editedAt
  const hasImage = msg.type === 'image' && !!msg.imageUrl
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(msg.content)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

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

  return (
    <div
      data-message-id={msg.id}
      className={`group flex items-end gap-2 ${own ? 'flex-row-reverse justify-start' : ''} ${
        highlighted ? 'rounded-2xl ring-2 ring-amber-400 bg-amber-50/60 -m-1 p-1' : ''
      }`}
    >
      <div
        className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm ${style.avatar}`}
        aria-hidden="true"
      >
        {msg.name.charAt(0).toUpperCase()}
      </div>
      <div
        className={`flex flex-col max-w-[75%] sm:max-w-[70%] ${own ? 'items-end' : 'items-start'}`}
      >
        {!own && (
          <span className={`text-[11px] font-semibold mb-0.5 px-1 ${style.label}`}>{msg.name}</span>
        )}
        <div
          className={`rounded-2xl shadow-sm ${style.bubble} ${
            hasImage ? 'p-1.5' : 'px-4 py-2.5'
          } ${own ? 'rounded-br-md' : 'rounded-bl-md'}`}
        >
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
          {editing ? (
            <div className="min-w-[200px] space-y-2 bg-white rounded-xl p-2">
              <Textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={2}
                maxLength={msg.type === 'image' ? 500 : 2000}
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
        <span
          className={`text-[10px] text-stone-400 mt-0.5 px-1 flex items-center gap-1 ${
            own ? 'flex-row-reverse' : ''
          }`}
        >
          {formatTime(new Date(msg.createdAt))}
          {edited && <span className="italic">· editado</span>}
          {own &&
            (read ? (
              <CheckCheck className="w-3.5 h-3.5 text-sky-500" aria-label="Visto" />
            ) : (
              <Check className="w-3.5 h-3.5 text-stone-300" aria-label="Enviado" />
            ))}
          {own && !editing && (onEdit || onDelete) && (
            <span className="flex items-center gap-0.5 ml-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              {msg.type === 'text' && onEdit && (
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
