'use client'

// Interruptor de notificaciones push: pide permiso, suscribe al navegador
// y guarda la suscripción en el servidor (o la elimina al desactivar).
import { useEffect, useState } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

const VAPID_KEY = process.env.NEXT_PUBLIC_VAPID_KEY ?? ''

function urlToKey(base64: string): ArrayBuffer {
  const padded = base64.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const bytes = Uint8Array.from([...bin].map((c) => c.charCodeAt(0)))
  return bytes.buffer as ArrayBuffer
}

type Status = 'unsupported' | 'denied' | 'off' | 'on'

export function PushToggle() {
  const [status, setStatus] = useState<Status>('off')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !('Notification' in window) ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !VAPID_KEY
    ) {
      setStatus('unsupported')
      return
    }
    if (Notification.permission === 'denied') {
      setStatus('denied')
      return
    }
    ;(async () => {
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        setStatus(sub ? 'on' : 'off')
      } catch {
        setStatus('off')
      }
    })()
  }, [])

  async function enable() {
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setStatus('denied')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlToKey(VAPID_KEY),
      })
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      setStatus(res.ok ? 'on' : 'off')
    } catch {
      setStatus('off')
    } finally {
      setBusy(false)
    }
  }

  async function disable() {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await fetch('/api/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        }).catch(() => {})
        await sub.unsubscribe().catch(() => {})
      }
      setStatus('off')
    } finally {
      setBusy(false)
    }
  }

  if (status === 'unsupported') return null

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-700">Avisos de mensajes</p>
        <p className="text-xs text-stone-400">
          {status === 'denied'
            ? 'Bloqueadas en el navegador: actívalas en el candado de la dirección.'
            : status === 'on'
              ? 'Recibirás un aviso aunque tengas el chat cerrado.'
              : 'Te avisaremos aunque tengas el chat cerrado.'}
        </p>
      </div>
      <Button
        type="button"
        onClick={() => (status === 'on' ? disable() : enable())}
        disabled={busy || status === 'denied'}
        variant={status === 'on' ? 'default' : 'outline'}
        className={`h-9 rounded-full shrink-0 ${
          status === 'on'
            ? 'bg-rose-500 hover:bg-rose-600 text-white'
            : 'border-rose-200 text-stone-600'
        }`}
      >
        {busy ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : status === 'on' ? (
          <>
            <Bell className="w-4 h-4" /> Activadas
          </>
        ) : (
          <>
            <BellOff className="w-4 h-4" /> Activar
          </>
        )}
      </Button>
    </div>
  )
}
