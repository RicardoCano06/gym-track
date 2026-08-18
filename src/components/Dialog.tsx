import { useState } from 'react'

export interface ConfirmRequest {
  title: string
  message?: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void | Promise<void>
}

interface DialogProps extends ConfirmRequest {
  onCancel: () => void
}

export function Dialog({
  title,
  message,
  confirmLabel,
  danger,
  onConfirm,
  onCancel,
}: DialogProps) {
  const [busy, setBusy] = useState(false)

  async function handleConfirm() {
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm rounded-t-2xl border border-edge bg-surface p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-semibold">{title}</h2>
        {message && <p className="mt-2 text-sm text-dim">{message}</p>}
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            onClick={onCancel}
            disabled={busy}
            className="min-h-12 rounded-lg border border-edge2 bg-surface2 px-4 py-3 text-sm font-medium text-soft transition-colors hover:text-strong disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className={`min-h-12 rounded-lg px-4 py-3 text-sm font-semibold text-neutral-950 transition-colors disabled:opacity-50 ${
              danger ? 'bg-red-500 hover:bg-red-400' : 'bg-emerald-500 hover:bg-emerald-400'
            }`}
          >
            {busy ? 'Un momento...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}