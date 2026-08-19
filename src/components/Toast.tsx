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

const STYLES: Record<ToastType, string> = {
  success: 'border-emerald-500/50',
  error: 'border-red-500/50',
  info: 'border-edge2',
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
      <div className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex flex-col items-center gap-2 px-4 md:bottom-8">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border bg-surface px-4 py-3 text-sm shadow-lg shadow-black/20 ${STYLES[t.type]}`}
          >
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