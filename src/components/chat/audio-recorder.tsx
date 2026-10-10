'use client'

// Grabadora de notas de voz: grabar → previsualizar → enviar o descartar.
// Usa MediaRecorder del navegador (webm donde se pueda, mp4 en Safari).
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Mic, Square, Send, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export type AudioRecorderHandle = {
  start: () => void
}

function pickMime(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus'
  if (MediaRecorder.isTypeSupported('audio/webm')) return 'audio/webm'
  if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4'
  return ''
}

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const MAX_SECONDS = 120

export const AudioRecorder = forwardRef<
  AudioRecorderHandle,
  {
    onSend: (dataUrl: string) => void
    sending: boolean
    hideIdle?: boolean
  }
>(function AudioRecorder({ onSend, sending, hideIdle }, ref) {
  const [phase, setPhase] = useState<'idle' | 'recording' | 'preview'>('idle')
  const [seconds, setSeconds] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<number | null>(null)
  const mimeRef = useRef('')
  const phaseRef = useRef<'idle' | 'recording' | 'preview'>('idle')

  function setPhaseAndRef(p: 'idle' | 'recording' | 'preview') {
    phaseRef.current = p
    setPhase(p)
  }

  function stopTracks() {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  function clearTimer() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => {
    return () => {
      clearTimer()
      stopTracks()
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useImperativeHandle(ref, () => ({
    start: () => {
      if (phaseRef.current === 'idle') startRecording()
    },
  }))

  async function startRecording() {
    setError('')
    const mime = pickMime()
    if (!mime) {
      setError('Tu navegador no permite grabar audio')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      mimeRef.current = mime
      chunksRef.current = []
      const rec = new MediaRecorder(stream, { mimeType: mime })
      recorderRef.current = rec
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime.split(';')[0] })
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)
        setPhaseAndRef('preview')
        stopTracks()
      }
      rec.start()
      setSeconds(0)
      setPhaseAndRef('recording')
      timerRef.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) {
            stopRecording()
            return s
          }
          return s + 1
        })
      }, 1000)
    } catch {
      setError('No se pudo acceder al micrófono')
    }
  }

  function stopRecording() {
    clearTimer()
    const rec = recorderRef.current
    if (rec && rec.state !== 'inactive') {
      rec.stop()
    } else {
      stopTracks()
      setPhaseAndRef('idle')
    }
  }

  function discard() {
    clearTimer()
    stopTracks()
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setPhaseAndRef('idle')
    setSeconds(0)
  }

  async function send() {
    if (!previewUrl || sending) return
    try {
      const blob = await (await fetch(previewUrl)).blob()
      const reader = new FileReader()
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('No se pudo leer el audio'))
        reader.readAsDataURL(blob)
      })
      onSend(dataUrl)
      discard()
    } catch {
      setError('No se pudo preparar el audio')
    }
  }

  if (phase === 'recording') {
    return (
      <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-full pl-3 pr-1.5 py-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" aria-hidden="true" />
        <span className="text-sm font-semibold text-red-600 tabular-nums min-w-10">
          {formatTimer(seconds)}
        </span>
        <Button
          type="button"
          size="icon"
          onClick={discard}
          aria-label="Descartar grabación"
          className="w-9 h-9 rounded-full bg-white border border-stone-200 text-stone-500 hover:text-red-500"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          onClick={stopRecording}
          aria-label="Detener y previsualizar"
          className="w-9 h-9 rounded-full bg-red-500 hover:bg-red-600 text-white"
        >
          <Square className="w-4 h-4" />
        </Button>
      </div>
    )
  }

  if (phase === 'preview' && previewUrl) {
    return (
      <div className="flex items-center gap-2 bg-white border border-rose-200 rounded-full pl-2 pr-1.5 py-1.5 max-w-full">
        <audio src={previewUrl} controls preload="metadata" className="h-9 max-w-44 sm:max-w-56" />
        <Button
          type="button"
          size="icon"
          onClick={discard}
          disabled={sending}
          aria-label="Descartar audio"
          className="w-9 h-9 shrink-0 rounded-full bg-white border border-stone-200 text-stone-500 hover:text-red-500"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          onClick={send}
          disabled={sending}
          aria-label="Enviar audio"
          className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    )
  }

  if (phase === 'idle' && hideIdle) {
    return error ? (
      <span className="text-[11px] text-red-500" role="alert">
        {error}
      </span>
    ) : null
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={startRecording}
        aria-label="Grabar audio"
        title="Grabar audio"
        className="w-11 h-11 rounded-full text-stone-400 hover:text-rose-500 hover:bg-rose-50 shrink-0"
      >
        <Mic className="w-5 h-5" />
      </Button>
      {error && (
        <span className="text-[11px] text-red-500" role="alert">
          {error}
        </span>
      )}
    </div>
  )
})
