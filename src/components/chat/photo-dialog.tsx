'use client'

// Diálogo de envío de foto: previsualización + descripción opcional + enviar
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Send, Trash2 } from 'lucide-react'

export function PhotoDialog({
  dataUrl,
  sending,
  onSend,
  onDiscard,
}: {
  dataUrl: string
  sending: boolean
  onSend: (caption: string) => void
  onDiscard: () => void
}) {
  const [caption, setCaption] = useState('')

  return (
    <Dialog open onOpenChange={(o) => !o && !sending && onDiscard()}>
      <DialogContent className="max-w-sm rounded-3xl bg-white border-rose-100">
        <DialogHeader>
          <DialogTitle className="text-stone-800">Enviar foto</DialogTitle>
        </DialogHeader>

        <img
          src={dataUrl}
          alt="Foto seleccionada"
          className="w-full max-h-[45vh] object-contain rounded-xl bg-stone-50 border border-stone-100"
        />

        <Input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Añade una descripción (opcional)"
          maxLength={500}
          disabled={sending}
          className="border-rose-200 focus-visible:ring-rose-300"
        />

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onDiscard}
            disabled={sending}
            className="rounded-full border-stone-200 text-stone-500 hover:text-rose-500 hover:border-rose-200"
          >
            <Trash2 className="w-4 h-4" />
            Descartar
          </Button>
          <Button
            type="button"
            onClick={() => onSend(caption.trim())}
            disabled={sending}
            className="rounded-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
