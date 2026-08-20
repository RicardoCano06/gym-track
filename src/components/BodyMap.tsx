import { useState } from 'react'
import { useLang } from '@/lib/lang-context'

interface BodyMapProps {
  onSelectGroup: (group: string) => void
  selectedGroup?: string
}

const FRONT_REGIONS = [
  { id: 'hombros', key: 'body.hombros', x: 28, y: 18, w: 14, h: 8 },
  { id: 'pecho', key: 'body.pecho', x: 42, y: 22, w: 16, h: 10 },
  { id: 'brazos', key: 'body.brazos', x: 18, y: 28, w: 10, h: 10 },
  { id: 'core', key: 'body.core', x: 42, y: 34, w: 16, h: 12 },
  { id: 'core', key: 'body.oblicuos', x: 34, y: 36, w: 8, h: 10 },
  { id: 'brazos', key: 'body.antebrazo', x: 14, y: 40, w: 10, h: 10 },
  { id: 'pierna', key: 'body.abductores', x: 36, y: 52, w: 10, h: 12 },
  { id: 'pierna', key: 'body.aductores', x: 46, y: 52, w: 10, h: 12 },
  { id: 'pierna', key: 'body.cuadriceps', x: 38, y: 64, w: 12, h: 16 },
]

const BACK_REGIONS = [
  { id: 'espalda', key: 'body.trapecio', x: 40, y: 16, w: 18, h: 8 },
  { id: 'brazos', key: 'body.triceps', x: 18, y: 26, w: 10, h: 10 },
  { id: 'espalda', key: 'body.dorsales', x: 38, y: 24, w: 18, h: 14 },
  { id: 'espalda', key: 'body.lumbar', x: 42, y: 38, w: 14, h: 10 },
  { id: 'pierna', key: 'body.gluteos', x: 38, y: 48, w: 18, h: 10 },
  { id: 'pierna', key: 'body.isquiotibiales', x: 38, y: 60, w: 12, h: 14 },
  { id: 'pierna', key: 'body.pantorrillas', x: 40, y: 76, w: 10, h: 12 },
]

function BodyOutline() {
  return (
    <g opacity="0.3" stroke="currentColor" strokeWidth="1" fill="none">
      <ellipse cx="50" cy="10" rx="6" ry="7" />
      <path d="M44 16 Q50 14 56 16 L58 20 Q62 22 64 28 L66 40 L62 42 L58 32 L56 48 L58 64 L60 80 L56 82 L52 64 L50 52 L48 64 L44 82 L40 80 L42 64 L44 48 L42 32 L38 42 L34 40 L36 28 Q38 22 42 20 Z" />
    </g>
  )
}

export default function BodyMap({ onSelectGroup, selectedGroup }: BodyMapProps) {
  const [view, setView] = useState<'front' | 'back'>('front')
  const { t } = useLang()
  const regions = view === 'front' ? FRONT_REGIONS : BACK_REGIONS

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-full max-w-[280px]">
        <svg viewBox="0 0 100 90" className="w-full text-dim2">
          <BodyOutline />
          {regions.map((r, i) => (
            <g key={`${view}-${i}`}>
              <rect
                x={r.x}
                y={r.y}
                width={r.w}
                height={r.h}
                rx={2}
                className={`cursor-pointer transition-colors ${
                  selectedGroup === r.id
                    ? 'fill-emerald-500/30 stroke-emerald-400'
                    : 'fill-transparent stroke-transparent hover:fill-emerald-500/10 hover:stroke-emerald-500/40'
                }`}
                onClick={() => onSelectGroup(r.id)}
              />
              <text
                x={r.x + r.w / 2}
                y={r.y + r.h / 2}
                textAnchor="middle"
                dominantBaseline="central"
                className="pointer-events-none select-none fill-current text-[3.2px] font-medium"
              >
                {t(r.key)}
              </text>
            </g>
          ))}
        </svg>
      </div>

      <button
        onClick={() => setView(view === 'front' ? 'back' : 'front')}
        className="flex min-h-11 items-center gap-2 rounded-xl border border-edge bg-surface px-4 py-2 text-sm font-medium text-soft transition-colors hover:bg-surface2"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
          <path
            fillRule="evenodd"
            d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.311-.311a1 1 0 00-1.414 1.414l.31.31a5.5 5.5 0 009.201-2.466l-.312-.311a1 1 0 00-1.414-1.414l.311-.31zM8.688 8.572a5.5 5.5 0 00-9.201-2.466l.311.31a1 1 0 001.414-1.414l-.31-.31a5.5 5.5 0 009.201 2.466l.312.311a1 1 0 001.414-1.414l-.311-.31z"
            clipRule="evenodd"
          />
        </svg>
        {t('body.flip')}
      </button>
    </div>
  )
}
