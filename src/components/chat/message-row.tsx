'use client'

// Burbuja de mensaje: texto y/o foto, hora y marcas de enviado/visto (✓ / ✓✓)
import { Check, CheckCheck } from 'lucide-react'
import type { ChatMessage } from './types'
import { styleFor, formatTime } from './utils'

export function MessageRow({
  msg,
  own,
  onImageClick,
}: {
  msg: ChatMessage
  own: boolean
  onImageClick: (url: string) => void
}) {
  const style = styleFor(msg.username)
  const read = !!msg.readAt
  const hasImage = msg.type === 'image' && !!msg.imageUrl

  return (
    <div className={`flex items-end gap-2 ${own ? 'flex-row-reverse justify-start' : ''}`}>
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
          {msg.content && (
            <p
              className={`text-[15px] leading-snug whitespace-pre-wrap break-words ${
                hasImage ? 'px-2.5 pt-1.5 pb-0.5' : ''
              }`}
            >
              {msg.content}
            </p>
          )}
        </div>
        <span
          className={`text-[10px] text-stone-400 mt-0.5 px-1 flex items-center gap-0.5 ${
            own ? 'flex-row-reverse' : ''
          }`}
        >
          {formatTime(new Date(msg.createdAt))}
          {own &&
            (read ? (
              <CheckCheck className="w-3.5 h-3.5 text-sky-500" aria-label="Visto" />
            ) : (
              <Check className="w-3.5 h-3.5 text-stone-300" aria-label="Enviado" />
            ))}
        </span>
      </div>
    </div>
  )
}
