'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { io, type Socket } from 'socket.io-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Heart,
  LogOut,
  Send,
  Loader2,
  Settings,
  Smile,
  ImagePlus,
  ArrowDown,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import type { ChatMessage, Partner, SessionUser } from '@/components/chat/types'
import {
  BASE_TITLE,
  dayKey,
  formatDayLabel,
  formatTime,
  isValidMessage,
  styleFor,
  compressImage,
  playPing,
} from '@/components/chat/utils'
import { MessageRow } from '@/components/chat/message-row'
import { TypingBubble } from '@/components/chat/typing-bubble'
import { Lightbox } from '@/components/chat/lightbox'
import { EmojiPicker } from '@/components/chat/emoji-picker'
import { PhotoDialog } from '@/components/chat/photo-dialog'
import { SettingsDialog } from '@/components/chat/settings-dialog'
import { ForgotPassword } from '@/components/chat/forgot-password'

function DaySeparator({ label }: { label: string }) {
  return (
    <div className="flex justify-center my-4">
      <span className="bg-white/90 border border-rose-100 text-stone-500 text-xs px-3 py-1 rounded-full shadow-sm">
        {label}
      </span>
    </div>
  )
}

export default function HomePage() {
  const { toast } = useToast()

  // ---- sesión ----
  const [checkingSession, setCheckingSession] = useState(true)
  const [me, setMe] = useState<SessionUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [partner, setPartner] = useState<Partner | null>(null)

  // ---- login / recuperación ----
  const [loginMode, setLoginMode] = useState<'login' | 'forgot'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)

  // ---- chat ----
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [socketConnected, setSocketConnected] = useState(false)

  // ---- presencia / escritura ----
  const [otherOnline, setOtherOnline] = useState(false)
  const [otherTyping, setOtherTyping] = useState(false)

  // ---- extras ----
  const [documentVisible, setDocumentVisible] = useState(true)
  const [hasUnread, setHasUnread] = useState(false)
  const [showScrollDown, setShowScrollDown] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [processingPhoto, setProcessingPhoto] = useState(false)

  const socketRef = useRef<Socket | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const mainRef = useRef<HTMLElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const photoInputRef = useRef<HTMLInputElement | null>(null)
  const prevCountRef = useRef(0)
  const lastReadSentRef = useRef(0)
  const typingRef = useRef(false)
  const typingStopTimerRef = useRef<number | null>(null)
  const otherTypingTimerRef = useRef<number | null>(null)

  const clearSessionState = useCallback(() => {
    socketRef.current?.disconnect()
    socketRef.current = null
    setMe(null)
    setToken(null)
    setPartner(null)
    setMessages([])
    setDraft('')
    setSocketConnected(false)
    setOtherOnline(false)
    setOtherTyping(false)
    setHasUnread(false)
    setSettingsOpen(false)
    setEmojiOpen(false)
    setPhotoDataUrl(null)
    document.title = BASE_TITLE
  }, [])

  // ---- comprobar sesión al cargar ----
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/me')
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) {
            setMe(data.user)
            setToken(data.token)
            setPartner(data.partner ?? null)
          }
        }
      } catch {
        // sin conexión con la API: se muestra el login
      } finally {
        if (!cancelled) setCheckingSession(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // ---- cargar historial ----
  useEffect(() => {
    if (!me) return
    let cancelled = false
    setLoadingMessages(true)
    ;(async () => {
      try {
        const res = await fetch('/api/messages')
        if (res.status === 401) {
          if (!cancelled) {
            toast({ title: 'Tu sesión ha caducado', description: 'Vuelve a iniciar sesión.' })
            clearSessionState()
          }
          return
        }
        if (res.ok) {
          const data = await res.json()
          if (!cancelled) {
            const valid: ChatMessage[] = (data.messages ?? []).filter(isValidMessage)
            setMessages(valid)
          }
        }
      } catch {
        if (!cancelled) {
          toast({ title: 'No se pudo cargar el historial', description: 'Comprueba tu conexión.' })
        }
      } finally {
        if (!cancelled) setLoadingMessages(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [me?.id, clearSessionState, toast])

  // ---- conexión websocket en tiempo real ----
  useEffect(() => {
    if (!me || !token) return

    // Never use the port in the URL, always use XTransformPort
    // Do not change the path, it is used by Caddy to forward to the correct port
    const socketInstance = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionDelay: 1000,
      timeout: 10000,
      auth: { token },
    })
    socketRef.current = socketInstance

    socketInstance.on('connect', () => setSocketConnected(true))
    socketInstance.on('disconnect', () => setSocketConnected(false))
    socketInstance.on('connect_error', (err: Error) => {
      setSocketConnected(false)
      if (err?.message === 'unauthorized') {
        toast({ title: 'Tu sesión ha caducado', description: 'Vuelve a iniciar sesión.' })
        clearSessionState()
      }
    })

    socketInstance.on('new-message', (msg: ChatMessage) => {
      if (!isValidMessage(msg)) return
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
      // aviso si llega mientras la pestaña está en segundo plano
      if (partner && msg.username === partner.username && document.hidden) {
        setHasUnread(true)
        playPing()
      }
    })

    socketInstance.on('presence-state', (data: { online?: string[] }) => {
      if (partner && Array.isArray(data?.online)) {
        setOtherOnline(data.online.includes(partner.username))
      }
    })

    socketInstance.on('user-typing', (data: { username?: string; typing?: boolean }) => {
      if (!partner || data?.username !== partner.username) return
      setOtherTyping(!!data.typing)
      if (otherTypingTimerRef.current) clearTimeout(otherTypingTimerRef.current)
      if (data.typing) {
        otherTypingTimerRef.current = window.setTimeout(() => setOtherTyping(false), 5000)
      }
    })

    socketInstance.on('messages-read', (data: { reader?: string; lastMessageId?: number }) => {
      if (!partner || data?.reader !== partner.username || typeof data.lastMessageId !== 'number') {
        return
      }
      const lastId = data.lastMessageId
      setMessages((prev) =>
        prev.map((m) =>
          m.username === me.username && m.id <= lastId && !m.readAt
            ? { ...m, readAt: new Date().toISOString() }
            : m,
        ),
      )
    })

    return () => {
      socketInstance.disconnect()
      if (socketRef.current === socketInstance) socketRef.current = null
    }
  }, [me, token, partner, clearSessionState, toast])

  // ---- visibilidad de la pestaña (aviso de mensaje + marcar leído) ----
  useEffect(() => {
    const onVisibility = () => {
      setDocumentVisible(!document.hidden)
      if (!document.hidden) setHasUnread(false)
    }
    document.addEventListener('visibilitychange', onVisibility)
    setDocumentVisible(!document.hidden)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  // ---- marcar como leídos los mensajes de la otra persona ----
  useEffect(() => {
    if (!me || !partner || !documentVisible) return
    const maxOther = messages
      .filter((m) => m.username === partner.username)
      .reduce((max, m) => Math.max(max, m.id), 0)
    if (maxOther > lastReadSentRef.current) {
      lastReadSentRef.current = maxOther
      fetch('/api/messages/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lastMessageId: maxOther }),
      }).catch(() => {})
    }
  }, [messages, documentVisible, me, partner])

  // ---- parpadeo del título cuando hay mensaje sin leer en segundo plano ----
  useEffect(() => {
    if (!hasUnread) {
      document.title = BASE_TITLE
      return
    }
    let on = false
    const t = setInterval(() => {
      on = !on
      document.title = on ? `(1) ${BASE_TITLE}` : BASE_TITLE
    }, 1200)
    return () => {
      clearInterval(t)
      document.title = BASE_TITLE
    }
  }, [hasUnread])

  // ---- scroll automático al último mensaje ----
  useEffect(() => {
    if (messages.length === 0) return
    const behavior: ScrollBehavior = prevCountRef.current === 0 ? 'auto' : 'smooth'
    bottomRef.current?.scrollIntoView({ behavior })
    prevCountRef.current = messages.length
  }, [messages, otherTyping])

  // ---- acciones ----

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (loggingIn) return
    setLoggingIn(true)
    setLoginError('')
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setLoginError(data?.error ?? 'No se pudo iniciar sesión')
        return
      }
      setUsername('')
      setPassword('')
      setMe(data.user)
      setToken(data.token)
      setPartner(data.partner ?? null)
    } catch {
      setLoginError('Error de conexión, inténtalo de nuevo')
    } finally {
      setLoggingIn(false)
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/logout', { method: 'POST' })
    } catch {
      // aunque falle la petición, se cierra la sesión en el navegador
    }
    clearSessionState()
  }

  // emite (una sola vez) el estado "escribiendo"
  function emitTyping(v: boolean) {
    if (typingRef.current === v) return
    typingRef.current = v
    socketRef.current?.emit('typing', { typing: v })
  }

  function handleDraftChange(value: string) {
    setDraft(value)
    const hasText = value.trim().length > 0
    emitTyping(hasText)
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current)
    if (hasText) {
      typingStopTimerRef.current = window.setTimeout(() => emitTyping(false), 2500)
    }
  }

  function resetTextareaHeight() {
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault()
    const content = draft.trim()
    if (!content || sending || !me) return
    setSending(true)
    emitTyping(false)
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (res.status === 401) {
        toast({ title: 'Tu sesión ha caducado', description: 'Vuelve a iniciar sesión.' })
        clearSessionState()
        return
      }
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.message) {
        toast({
          title: 'No se pudo enviar el mensaje',
          description: data?.error ?? 'Inténtalo de nuevo.',
        })
        return
      }
      if (isValidMessage(data.message)) {
        setMessages((prev) =>
          prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message],
        )
      }
      setDraft('')
      resetTextareaHeight()
      textareaRef.current?.focus()
    } catch {
      toast({ title: 'No se pudo enviar el mensaje', description: 'Comprueba tu conexión.' })
    } finally {
      setSending(false)
    }
  }

  // ---- fotos ----

  async function handlePhotoFile(file: File | null | undefined) {
    if (!file) return
    setProcessingPhoto(true)
    try {
      const dataUrl = await compressImage(file)
      setPhotoDataUrl(dataUrl)
    } catch (err) {
      toast({
        title: 'No se pudo preparar la foto',
        description: err instanceof Error ? err.message : 'Prueba con otra imagen.',
      })
    } finally {
      setProcessingPhoto(false)
      if (photoInputRef.current) photoInputRef.current.value = ''
    }
  }

  async function handleSendPhoto(caption: string) {
    if (!photoDataUrl || uploading || !me) return
    setUploading(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: caption, image: photoDataUrl }),
      })
      if (res.status === 401) {
        toast({ title: 'Tu sesión ha caducado', description: 'Vuelve a iniciar sesión.' })
        clearSessionState()
        return
      }
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.message) {
        toast({
          title: 'No se pudo enviar la foto',
          description: data?.error ?? 'Inténtalo de nuevo.',
        })
        return
      }
      if (isValidMessage(data.message)) {
        setMessages((prev) =>
          prev.some((m) => m.id === data.message.id) ? prev : [...prev, data.message],
        )
      }
      setPhotoDataUrl(null)
      textareaRef.current?.focus()
    } catch {
      toast({ title: 'No se pudo enviar la foto', description: 'Comprueba tu conexión.' })
    } finally {
      setUploading(false)
    }
  }

  // ---- render ----

  if (checkingSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50 gap-4">
        <Heart className="w-10 h-10 text-rose-400 fill-rose-300 animate-pulse" />
        <p className="text-sm text-stone-500">Cargando…</p>
      </div>
    )
  }

  if (!me) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50 px-4 py-8">
        <Card className="w-full max-w-sm border-rose-100 shadow-xl shadow-rose-100/70 rounded-3xl bg-white/90 backdrop-blur">
          <CardContent className="p-8">
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center shadow-lg shadow-rose-200 mb-4">
                <Heart className="w-8 h-8 text-white fill-white" />
              </div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <span className="text-rose-500">Eva</span>
                <Heart className="w-4 h-4 text-pink-500 fill-pink-500" aria-hidden="true" />
                <span className="text-emerald-600">David</span>
              </h1>
              <p className="text-sm text-stone-500 mt-1">Nuestro chat privado</p>
            </div>

            {loginMode === 'login' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="username" className="text-sm font-medium text-stone-700">
                    Usuario
                  </label>
                  <Input
                    id="username"
                    name="username"
                    autoComplete="username"
                    autoCapitalize="none"
                    placeholder="eva o david"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={loggingIn}
                    className="h-11 border-rose-200 focus-visible:ring-rose-300"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-stone-700">
                    Contraseña
                  </label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Tu contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={loggingIn}
                    className="h-11 border-rose-200 focus-visible:ring-rose-300"
                  />
                </div>

                {loginError && (
                  <p className="text-sm text-red-500 text-center" role="alert">
                    {loginError}
                  </p>
                )}

                <Button
                  type="submit"
                  disabled={loggingIn || !username.trim() || !password}
                  className="w-full h-11 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-full"
                >
                  {loggingIn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Entrando…
                    </>
                  ) : (
                    'Entrar'
                  )}
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    setLoginMode('forgot')
                    setLoginError('')
                  }}
                  className="w-full text-center text-sm text-rose-400 hover:text-rose-500 underline-offset-2 hover:underline"
                >
                  ¿Has olvidado tu contraseña?
                </button>
              </form>
            ) : (
              <ForgotPassword
                onBack={() => {
                  setLoginMode('login')
                  setLoginError('')
                }}
                onDone={() => setLoginMode('login')}
              />
            )}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---- vista de chat ----

  const partnerStyle = styleFor(partner?.username ?? '')
  const partnerName = partner?.name ?? 'Chat'
  const statusText = otherTyping
    ? 'Escribiendo…'
    : otherOnline
      ? 'En línea'
      : 'Desconectado'

  const rows: ReactNode[] = []
  let lastDay: number | null = null
  for (const msg of messages) {
    const d = new Date(msg.createdAt)
    const key = dayKey(d)
    if (key !== lastDay) {
      rows.push(<DaySeparator key={`day-${key}`} label={formatDayLabel(d)} />)
      lastDay = key
    }
    rows.push(
      <MessageRow
        key={msg.id}
        msg={msg}
        own={msg.username === me.username}
        onImageClick={setLightboxUrl}
      />,
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50">
      <header className="shrink-0 border-b border-rose-100 bg-white/80 backdrop-blur z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between px-4 py-3 gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow ${partnerStyle.avatar}`}
                aria-hidden="true"
              >
                {partnerName.charAt(0).toUpperCase()}
              </div>
              {otherOnline && (
                <span
                  className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"
                  title="En línea"
                />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-lg leading-tight truncate">{partnerName}</h1>
              <p className="text-xs text-stone-500 flex items-center gap-1.5">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    otherTyping
                      ? 'bg-rose-400 animate-pulse'
                      : otherOnline
                        ? 'bg-emerald-500'
                        : 'bg-stone-300'
                  }`}
                  aria-hidden="true"
                />
                {statusText}
                {!socketConnected && <span>· reconectando…</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSettingsOpen(true)}
              aria-label="Ajustes"
              title="Ajustes"
              className="text-stone-400 hover:text-rose-500 hover:bg-rose-50 rounded-full"
            >
              <Settings className="w-5 h-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="text-stone-400 hover:text-rose-500 hover:bg-rose-50 rounded-full"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto px-4 py-4 relative"
        onScroll={(e) => {
          const el = e.currentTarget
          setShowScrollDown(el.scrollHeight - el.scrollTop - el.clientHeight > 300)
        }}
      >
        <div className="max-w-2xl mx-auto">
          {loadingMessages ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-stone-400">
              <Loader2 className="w-6 h-6 animate-spin" />
              <p className="text-sm">Cargando mensajes…</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-stone-400">
              <Heart className="w-10 h-10 text-rose-200 fill-rose-100" />
              <p className="text-sm">Aún no hay mensajes. ¡Escribe el primero!</p>
            </div>
          ) : (
            <div className="space-y-2">{rows}</div>
          )}

          {otherTyping && (
            <div className="mt-2">
              <TypingBubble name={partnerName} />
            </div>
          )}
        </div>
        <div ref={bottomRef} aria-hidden="true" />
      </main>

      {showScrollDown && (
        <button
          type="button"
          onClick={() =>
            bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
          }
          aria-label="Ir al último mensaje"
          className="absolute bottom-24 right-5 z-20 w-10 h-10 rounded-full bg-white shadow-lg border border-rose-100 flex items-center justify-center text-rose-500 hover:bg-rose-50 transition"
        >
          <ArrowDown className="w-5 h-5" />
        </button>
      )}

      <footer className="shrink-0 border-t border-rose-100 bg-white/80 backdrop-blur px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <form onSubmit={handleSend} className="max-w-2xl mx-auto flex items-end gap-2 relative">
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => handlePhotoFile(e.target.files?.[0])}
          />

          <div className="relative shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setEmojiOpen((v) => !v)}
              aria-label="Emojis"
              title="Emojis"
              className={`w-11 h-11 rounded-full ${
                emojiOpen ? 'text-rose-500 bg-rose-50' : 'text-stone-400 hover:text-rose-500 hover:bg-rose-50'
              }`}
            >
              <Smile className="w-5 h-5" />
            </Button>
            <EmojiPicker
              open={emojiOpen}
              onClose={() => setEmojiOpen(false)}
              onPick={(emoji) => {
                handleDraftChange(draft + emoji)
                setEmojiOpen(false)
                textareaRef.current?.focus()
              }}
            />
          </div>

          <Textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend(e)
              }
            }}
            placeholder="Escribe un mensaje…"
            aria-label="Escribe un mensaje"
            maxLength={2000}
            rows={1}
            className="flex-1 min-h-11 max-h-32 resize-none rounded-3xl border-rose-200 focus-visible:ring-rose-300 bg-white py-2.5"
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => photoInputRef.current?.click()}
            disabled={processingPhoto || uploading}
            aria-label="Enviar foto"
            title="Enviar foto"
            className="w-11 h-11 rounded-full text-stone-400 hover:text-rose-500 hover:bg-rose-50 shrink-0"
          >
            {processingPhoto ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <ImagePlus className="w-5 h-5" />
            )}
          </Button>

          <Button
            type="submit"
            disabled={sending || uploading || !draft.trim()}
            aria-label="Enviar mensaje"
            className="w-11 h-11 p-0 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white shrink-0"
          >
            {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
          </Button>
        </form>
      </footer>

      {lightboxUrl && <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}

      {photoDataUrl && (
        <PhotoDialog
          dataUrl={photoDataUrl}
          sending={uploading}
          onSend={handleSendPhoto}
          onDiscard={() => setPhotoDataUrl(null)}
        />
      )}

      {settingsOpen && (
        <SettingsDialog
          me={me}
          onEmailSaved={(email) => setMe({ ...me, email })}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  )
}
