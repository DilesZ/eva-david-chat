'use client'

// Flujo "¿Has olvidado tu contraseña?" en 2 pasos:
// 1) usuario -> envía código al correo guardado
// 2) código + nueva contraseña
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowLeft, KeyRound, Loader2 } from 'lucide-react'

type Phase = 'username' | 'code' | 'success'

export function ForgotPassword({
  onBack,
  onDone,
}: {
  onBack: () => void
  onDone: () => void
}) {
  const [phase, setPhase] = useState<Phase>('username')
  const [username, setUsername] = useState('')
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function requestReset(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/password/reset-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error ?? 'No se pudo enviar el código')
        return
      }
      setMaskedEmail(data.maskedEmail ?? null)
      setPhase('code')
    } catch {
      setError('Error de conexión, inténtalo de nuevo')
    } finally {
      setBusy(false)
    }
  }

  async function confirmReset(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    if (newPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres')
      return
    }
    if (newPassword !== repeatPassword) {
      setError('Las dos contraseñas no coinciden')
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/password/reset-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, code: code.trim(), newPassword }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error ?? 'No se pudo cambiar la contraseña')
        return
      }
      setPhase('success')
    } catch {
      setError('Error de conexión, inténtalo de nuevo')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-sm text-stone-400 hover:text-rose-500"
      >
        <ArrowLeft className="w-4 h-4" />
        Volver al inicio de sesión
      </button>

      {phase === 'username' && (
        <form onSubmit={requestReset} className="space-y-4">
          <div>
            <h2 className="font-bold text-lg text-stone-800 flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-rose-500" />
              Recuperar contraseña
            </h2>
            <p className="text-sm text-stone-500 mt-1">
              Escribe tu usuario y te enviaremos un código de verificación a tu correo.
            </p>
          </div>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Tu usuario (eva o david)"
            autoCapitalize="none"
            disabled={busy}
            className="h-11 border-rose-200 focus-visible:ring-rose-300"
          />
          {error && (
            <p className="text-sm text-red-500" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={busy || !username.trim()}
            className="w-full h-11 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-full"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Enviar código
          </Button>
        </form>
      )}

      {phase === 'code' && (
        <form onSubmit={confirmReset} className="space-y-4">
          <h2 className="font-bold text-lg text-stone-800">Comprueba tu correo</h2>
          <p className="text-sm text-stone-500">
            {maskedEmail ? (
              <>
                Hemos enviado un código de 6 dígitos a <b className="text-stone-700">{maskedEmail}</b>
                . Caduca en 10 minutos.
              </>
            ) : (
              'Escribe el código de 6 dígitos que te hemos enviado por correo.'
            )}
          </p>
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Código de 6 dígitos"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            disabled={busy}
            className="h-11 text-center tracking-[0.4em] border-rose-200 focus-visible:ring-rose-300"
          />
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="Nueva contraseña (mín. 6 caracteres)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={busy}
            className="h-11 border-rose-200 focus-visible:ring-rose-300"
          />
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="Repite la nueva contraseña"
            value={repeatPassword}
            onChange={(e) => setRepeatPassword(e.target.value)}
            disabled={busy}
            className="h-11 border-rose-200 focus-visible:ring-rose-300"
          />
          {error && (
            <p className="text-sm text-red-500" role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={busy || code.length !== 6 || !newPassword || !repeatPassword}
            className="w-full h-11 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-full"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Cambiar contraseña
          </Button>
        </form>
      )}

      {phase === 'success' && (
        <div className="space-y-4 text-center">
          <h2 className="font-bold text-lg text-emerald-600">¡Contraseña cambiada!</h2>
          <p className="text-sm text-stone-500">
            Ya puedes iniciar sesión con tu nueva contraseña.
          </p>
          <Button
            type="button"
            onClick={onDone}
            className="w-full h-11 bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white rounded-full"
          >
            Ir al inicio de sesión
          </Button>
        </div>
      )}
    </div>
  )
}
