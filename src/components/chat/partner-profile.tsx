'use client'

// Perfil de la otra persona: foto grande, nombre y estado.
// Sin APIs nuevas: usa los datos que ya tiene el chat.
import { Images, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import type { Partner } from './types'
import { styleFor } from './utils'

export function PartnerProfile({
  open,
  partner,
  statusText,
  online,
  typing,
  avatarImg,
  onClose,
  onOpenGallery,
}: {
  open: boolean
  partner: Partner
  statusText: string
  online: boolean
  typing: boolean
  avatarImg: string | null
  onClose: () => void
  onOpenGallery: () => void
}) {
  const style = styleFor(partner.username)

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xs rounded-3xl">
        <DialogHeader>
          <DialogTitle className="sr-only">Perfil de {partner.name}</DialogTitle>
        </DialogHeader>
        <button
          type="button"
          aria-label="Cerrar perfil"
          onClick={onClose}
          className="absolute top-3 right-3 p-1.5 rounded-full text-stone-400 hover:bg-stone-100"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex flex-col items-center gap-2 pt-2">
          <div
            className={`w-28 h-28 rounded-full flex items-center justify-center text-white text-4xl font-bold shadow-lg overflow-hidden ${style.avatar}`}
          >
            {avatarImg ? (
              <img src={avatarImg} alt={`Foto de ${partner.name}`} className="w-full h-full object-cover" />
            ) : (
              partner.name.charAt(0).toUpperCase()
            )}
          </div>
          <h2 className="text-xl font-bold text-stone-800">{partner.name}</h2>
          <p className="text-xs text-stone-500 flex items-center gap-1.5 -mt-1">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                typing ? 'bg-rose-400 animate-pulse' : online ? 'bg-emerald-500' : 'bg-stone-300'
              }`}
              aria-hidden="true"
            />
            {statusText}
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              onClose()
              onOpenGallery()
            }}
            className="mt-2 h-9 rounded-full border-rose-200 text-stone-600 text-xs"
          >
            <Images className="w-4 h-4 text-rose-500" /> Ver fotos compartidas
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
