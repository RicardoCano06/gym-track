import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ToastContext } from '@/lib/toast-context'
import type { ToastType } from '@/lib/toast-context'

interface ToastItem {
  id: number
  type: ToastType
  message: string
}

const STYLES: Record<ToastType, string> = {
  success: 'border-emerald-500/50',
  error: 'border-red-500/50',
  info: 'border-edge2',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const pushToast = useCallback((type: ToastType, message: string) => {
    const id = ++counter.current
    setToasts((prev) => [...prev.slice(-2), { id, type, message }])
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex flex-col items-center gap-2 px-4 md:bottom-8">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto w-full max-w-sm rounded-xl border bg-surface px-4 py-3 text-sm shadow-lg shadow-black/20 ${STYLES[t.type]}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}