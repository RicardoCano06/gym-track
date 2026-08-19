interface ErrorStateProps {
  title?: string
  message?: string
  onRetry?: () => void
}

export default function ErrorState({
  title = 'Algo salió mal',
  message = 'No pudimos cargar esta sección. Intentá de nuevo.',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-3xl shadow-[0_0_24px_rgba(244,63,94,0.15)]">
        ⚠️
      </div>
      <p className="font-semibold text-soft">{title}</p>
      <p className="max-w-xs text-sm text-dim">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-1 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 shadow-[0_4px_20px_rgba(16,185,129,0.35)] transition-all duration-200 hover:bg-emerald-400 active:scale-[0.98]"
        >
          Reintentar
        </button>
      )}
    </div>
  )
}
