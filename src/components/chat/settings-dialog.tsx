'use client'

// Diálogo de ajustes: correo electrónico y cambio de contraseña verificado por código
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Loader2, Mail, KeyRound, ShieldCheck, Info, BellRing } from 'lucide-react'
import type { SessionUser } from './types'
import { PushToggle } from './push-toggle'

type Phase = 'idle' | 'code-sent' | 'done'

export function SettingsDialog({
  me,
  onEmailSaved,
  onClose,
}: {
  me: SessionUser
  onEmailSaved: (email: string) => void
  onClose: () => void
}) {
  // ---- correo ----
  const [email, setEmail] = useState(me.email ?? '')
  const [savingEmail, setSavingEmail] = useState(false)

  // ---- cambio de contraseña ----
  const [phase, setPhase] = useState<Phase>('idle')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [maskedEmail, setMaskedEmail] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [repeatPassword, setRepeatPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function handleSaveEmail(e: React.FormEvent) {
    e.preventDefault()
    if (savingEmail) return
    setSavingEmail(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/profile/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error ?? 'No se pudo guardar el correo')
        return
      }
      onEmailSaved(data.email)
      setSuccess('Correo guardado. Ya puedes verificar cambios de contraseña.')
    } catch {
      setError('Error de conexión, inténtalo de nuevo')
    } finally {
      setSavingEmail(false)
    }
  }

  async function requestCode() {
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/password/request-change', { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error ?? 'No se pudo enviar el código')
        return
      }
      setMaskedEmail(data.maskedEmail ?? null)
      setDevCode(data.dev ? String(data.devCode) : null)
      setPhase('code-sent')
    } catch {
      setError('Error de conexión, inténtalo de nuevo')
    } finally {
      setBusy(false)
    }
  }

  async function handleConfirmChange(e: React.FormEvent) {
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
      const res = await fetch('/api/password/confirm-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), newPassword }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error ?? 'No se pudo cambiar la contraseña')
        return
      }
      setPhase('done')
      setSuccess('¡Contraseña cambiada! Se han cerrado tus otras sesiones.')
      setCode('')
      setNewPassword('')
      setRepeatPassword('')
    } catch {
      setError('Error de conexión, inténtalo de nuevo')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-3xl bg-white border-rose-100 max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-stone-800">
            <ShieldCheck className="w-5 h-5 text-rose-500" />
            Ajustes de {me.name}
          </DialogTitle>
          <DialogDescription className="text-stone-500">
            Tu cuenta y la seguridad de tu contraseña
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}
        {success && <p className="text-sm text-emerald-600">{success}</p>}

        {/* ---- correo electrónico ---- */}
        <section className="space-y-2">
          <Label htmlFor="settings-email" className="flex items-center gap-1.5 text-stone-700">
            <Mail className="w-4 h-4 text-rose-400" />
            Tu correo electrónico
          </Label>
          <form onSubmit={handleSaveEmail} className="flex gap-2">
            <Input
              id="settings-email"
              type="email"
              autoComplete="email"
              placeholder="tucorreo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={savingEmail}
              className="h-10 border-rose-200 focus-visible:ring-rose-300"
            />
            <Button
              type="submit"
              disabled={savingEmail || !email.trim() || email === (me.email ?? '')}
              className="h-10 rounded-full bg-rose-500 hover:bg-rose-600 text-white shrink-0"
            >
              {savingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Guardar'}
            </Button>
          </form>
          <p className="text-xs text-stone-400">
            Necesario para enviarte el código de verificación cuando cambies tu contraseña.
          </p>
        </section>

        <Separator className="bg-rose-100" />

        {/* ---- avisos push ---- */}
        <section className="space-y-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-stone-700">
            <BellRing className="w-4 h-4 text-rose-400" />
            Notificaciones
          </h3>
          <PushToggle />
        </section>

        <Separator className="bg-rose-100" />

        {/* ---- cambio de contraseña ---- */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-stone-700">
            <KeyRound className="w-4 h-4 text-rose-400" />
            Cambiar contraseña
          </h3>

          {phase === 'idle' && (
            <>
              {!me.email && (
                <p className="text-xs flex items-start gap-1.5 text-amber-600 bg-amber-50 border border-amber-100 rounded-xl p-2.5">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  Guarda primero tu correo arriba: enviaremos un código de verificación para
                  confirmar el cambio.
                </p>
              )}
              <Button
                type="button"
                onClick={requestCode}
                disabled={busy || !me.email}
                className="w-full h-10 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Verificar con mi correo
              </Button>
            </>
          )}

          {phase === 'code-sent' && (
            <form onSubmit={handleConfirmChange} className="space-y-3">
              <p className="text-xs text-stone-500">
                Código enviado a <b className="text-stone-700">{maskedEmail}</b>. Caduca en 10
                minutos.
              </p>
              {devCode && (
                <p className="text-xs flex items-start gap-1.5 text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <b>Modo pruebas:</b> el correo no está configurado en el servidor. Tu código es{' '}
                    <b className="tracking-widest">{devCode}</b>. Cuando se configure el SMTP llegará
                    por email.
                  </span>
                </p>
              )}
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
                className="h-10 border-rose-200 focus-visible:ring-rose-300"
              />
              <Input
                type="password"
                autoComplete="new-password"
                placeholder="Repite la nueva contraseña"
                value={repeatPassword}
                onChange={(e) => setRepeatPassword(e.target.value)}
                disabled={busy}
                className="h-10 border-rose-200 focus-visible:ring-rose-300"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPhase('idle')
                    setDevCode(null)
                    setCode('')
                    setError('')
                  }}
                  disabled={busy}
                  className="h-10 rounded-full border-stone-200 text-stone-500"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={busy || code.length !== 6 || !newPassword || !repeatPassword}
                  className="flex-1 h-10 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-600 hover:to-pink-600 text-white"
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Cambiar contraseña
                </Button>
              </div>
            </form>
          )}

          {phase === 'done' && (
            <p className="text-sm text-emerald-600">
              Todo listo. La próxima vez que entres, usa tu nueva contraseña.
            </p>
          )}
        </section>

        <Separator className="bg-rose-100" />

        <section className="flex items-center justify-between">
          <span className="text-xs text-stone-400">Usuario</span>
          <Badge variant="secondary" className="bg-rose-50 text-rose-500 border border-rose-100">
            {me.username}
          </Badge>
        </section>
      </DialogContent>
    </Dialog>
  )
}
