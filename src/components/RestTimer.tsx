import { useRestTimer } from '@/components/TimerContext'

const QUICK_OPTIONS = [60, 90, 120, 180]

export default function RestTimer() {
  const { running, remaining, start, extend, stop } = useRestTimer()

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')

  return (
    <div className="flex items-center gap-2 rounded-lg border border-edge bg-surface px-3 py-2">
      <span className="text-xs font-medium uppercase tracking-wide text-dim2">
        Descanso
      </span>
      <span
        className={`font-mono text-lg font-bold tabular-nums ${
          running && remaining === 0 ? 'text-emerald-400' : 'text-strong'
        }`}
      >
        {mm}:{ss}
      </span>
      {!running ? (
        <div className="flex gap-1">
          {QUICK_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => start(s)}
              className="min-h-12 rounded-md bg-surface2 px-3 py-2 text-xs font-medium text-soft transition-colors hover:bg-emerald-500/20 hover:text-emerald-400"
            >
              {s / 60}m
            </button>
          ))}
        </div>
      ) : (
        <div className="flex gap-1">
          <button
            onClick={extend}
            className="min-h-12 rounded-md bg-surface2 px-3 py-2 text-xs font-medium text-soft transition-colors hover:bg-emerald-500/20 hover:text-emerald-400"
          >
            +30s
          </button>
          <button
            onClick={stop}
            className="min-h-12 rounded-md bg-surface2 px-3 py-2 text-xs font-medium text-soft transition-colors hover:bg-red-500/20 hover:text-red-400"
          >
            Detener
          </button>
        </div>
      )}
    </div>
  )
}
