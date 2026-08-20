import { useRestTimer } from '@/components/TimerContext'
import { useLang } from '@/lib/lang-context'

const QUICK_OPTIONS = [60, 90, 120, 180]
const R = 30
const C = 2 * Math.PI * R

export default function RestTimer() {
  const { running, remaining, total, start, extend, stop } = useRestTimer()
  const { t } = useLang()

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')
  const progress = total > 0 ? remaining / total : 0
  const urgent = running && remaining <= 10

  const ringColor = !running
    ? 'var(--color-edge2)'
    : urgent
      ? '#f43f5e'
      : '#10b981'

  return (
    <div className="glass-card card-hairline flex flex-wrap items-center gap-4 rounded-2xl px-4 py-3">
      <div className="relative h-16 w-16 shrink-0">
        <svg viewBox="0 0 72 72" className="h-full w-full -rotate-90">
          <circle
            cx="36"
            cy="36"
            r={R}
            fill="none"
            stroke="var(--color-edge)"
            strokeWidth="5"
          />
          <circle
            cx="36"
            cy="36"
            r={R}
            fill="none"
            stroke={ringColor}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - progress)}
            className="transition-all duration-300 ease-linear"
          />
        </svg>
        <span
          className={`absolute inset-0 flex items-center justify-center font-mono text-sm font-bold tabular-nums ${
            !running ? 'text-dim2' : urgent ? 'text-rose-400' : 'text-strong'
          }`}
        >
          {running ? `${mm}:${ss}` : '—'}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-dim2">{t('rest.title')}</p>
        <p className={`text-lg font-bold tracking-tight ${urgent ? 'text-rose-400' : 'text-high'}`}>
          {running ? (urgent ? t('rest.working') : t('rest.resting')) : t('rest.ready')}
        </p>
      </div>

      {!running ? (
        <div className="flex gap-1.5">
          {QUICK_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => start(s)}
              className="min-h-11 rounded-lg bg-surface2 px-3 py-2 font-mono text-xs font-medium text-soft transition-all duration-200 hover:bg-surface hover:text-strong active:scale-95"
            >
              {s / 60}m
            </button>
          ))}
        </div>
      ) : (
        <div className="flex gap-1.5">
          <button
            onClick={extend}
            className="min-h-11 rounded-lg bg-surface2 px-3 py-2 text-xs font-medium text-soft transition-all duration-200 hover:bg-surface hover:text-strong active:scale-95"
          >
            +30s
          </button>
          <button
            onClick={stop}
            className="min-h-11 rounded-lg bg-surface2 px-3 py-2 text-xs font-medium text-soft transition-all duration-200 hover:bg-rose-500/20 hover:text-rose-400 active:scale-95"
          >
            {t('rest.stop')}
          </button>
        </div>
      )}
    </div>
  )
}