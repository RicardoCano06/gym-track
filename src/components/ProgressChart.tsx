import { useState } from 'react'
import type { ExerciseProgressEntry } from '@/lib/db'
import { formatShortDate } from '@/lib/format'

export function ProgressChart({ series }: { series: ExerciseProgressEntry[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  const weights = series.map((e) => e.weight_kg ?? 0)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const span = max - min || 1
  const W = 300
  const H = 84
  const pad = 8
  const coords = series.map((e, i) => {
    const x = (i / (series.length - 1)) * W
    const y = H - pad - ((e.weight_kg! - min) / span) * (H - pad * 2)
    return [x, y] as const
  })
  const line = coords.map(([x, y]) => `${x},${y}`).join(' ')
  const area = `0,${H} ${line} ${W},${H}`

  return (
    <div className="mt-5">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <defs>
          <linearGradient id="progress-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#progress-area)" />
        <polyline
          points={line}
          className="fill-none stroke-emerald-500"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 4px rgba(16,185,129,0.4))' }}
        />
        {coords.map(([x, y], i) => {
          const active = hovered === i
          return (
            <g
              key={i}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              className="cursor-pointer"
            >
              <circle
                cx={x}
                cy={y}
                r={active ? 6 : 3.5}
                className="fill-emerald-500 transition-all duration-150"
                style={{ filter: active ? 'drop-shadow(0 0 6px rgba(16,185,129,0.8))' : 'none' }}
              />
              <circle cx={x} cy={y} r={12} className="fill-transparent" />
              {active && (
                <>
                  <line
                    x1={x}
                    y1={y - 14}
                    x2={x}
                    y2={y + 14}
                    className="stroke-emerald-500/40"
                    strokeDasharray="2 3"
                  />
                  <g transform={`translate(${Math.min(Math.max(x, 34), W - 34)} ${Math.max(y - 26, 10)})`}>
                    <rect x={-30} y={-11} width={60} height={20} rx={6} className="fill-neutral-950/90" />
                    <text
                      x={0}
                      y={2}
                      textAnchor="middle"
                      fontSize={10}
                      fontWeight={700}
                      className="fill-emerald-400"
                    >
                      {series[i].weight_kg} kg
                    </text>
                  </g>
                </>
              )}
            </g>
          )
        })}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-dim2">
        <span className="font-mono tabular-nums">
          {formatShortDate(series[0].date)} · {series[0].weight_kg} kg
        </span>
        <span className="font-mono tabular-nums">
          {series[series.length - 1].weight_kg} kg · {formatShortDate(series[series.length - 1].date)}
        </span>
      </div>
    </div>
  )
}