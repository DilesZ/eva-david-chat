'use client'

// Burbuja "está escribiendo…" con tres puntos animados
export function TypingBubble({ name }: { name: string }) {
  return (
    <div className="flex items-end gap-2" aria-live="polite" aria-label={`${name} está escribiendo`}>
      <div className="bg-white px-4 py-3.5 rounded-2xl rounded-bl-md shadow-sm flex items-center gap-1.5">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="w-2 h-2 rounded-full bg-stone-300 animate-bounce"
            style={{ animationDelay: `${delay}ms`, animationDuration: '900ms' }}
          />
        ))}
      </div>
    </div>
  )
}
