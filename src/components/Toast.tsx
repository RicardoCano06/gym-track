import { useCallback, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ToastContext } from '@/lib/toast-context'
import type { ToastAction, ToastType } from '@/lib/toast-context'

interface ToastItem {
  id: number
  type: ToastType
  message: string
  action?: ToastAction
}

const ACCENTS: Record<ToastType, string> = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  info: 'text-sky-400',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  const pushToast = useCallback(
    (type: ToastType, message: string, action?: ToastAction) => {
      const id = ++counter.current
      setToasts((prev) => [...prev.slice(-2), { id, type, message, action }])
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 4000)
    },
    [],
  )

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-32 z-50 flex flex-col items-center gap-2 px-4 md:bottom-10">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="glass-strong pointer-events-auto flex w-full max-w-sm animate-rise items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-[0_16px_40px_-12px_rgba(0,0,0,0.7)]"
          >
            <span
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${ACCENTS[t.type]}`}
            >
              {t.type === 'success' ? '✓' : t.type === 'error' ? '✕' : 'ℹ'}
            </span>
            <span className="flex-1">{t.message}</span>
            {t.action && (
              <button
                onClick={() => {
                  t.action?.onClick()
                  setToasts((prev) => prev.filter((x) => x.id !== t.id))
                }}
                className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-emerald-400 transition-colors hover:bg-emerald-500/10"
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}