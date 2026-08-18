import type { ExerciseProgressEntry } from '@/lib/db'
import { formatShortDate } from '@/lib/format'

export function ProgressChart({ series }: { series: ExerciseProgressEntry[] }) {
  const weights = series.map((e) => e.weight_kg ?? 0)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const span = max - min || 1
  const W = 300
  const H = 72
  const coords = series.map((e, i) => {
    const x = (i / (series.length - 1)) * W
    const y = H - 6 - ((e.weight_kg! - min) / span) * (H - 12)
    return [x, y] as const
  })

  return (
    <div className="mt-5">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <polyline
          points={coords.map(([x, y]) => `${x},${y}`).join(' ')}
          className="fill-none stroke-emerald-500"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={3} className="fill-emerald-500" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-dim2">
        <span>
          {formatShortDate(series[0].date)} · {series[0].weight_kg} kg
        </span>
        <span>
          {series[series.length - 1].weight_kg} kg · {formatShortDate(series[series.length - 1].date)}
        </span>
      </div>
    </div>
  )
}