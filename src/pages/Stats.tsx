import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { ProgressChart } from '@/components/ProgressChart'
import { formatShortDate } from '@/lib/format'
import {
  fetchExerciseProgress,
  fetchPRs,
  fetchStreak,
  fetchWeeklyVolumeSeries,
} from '@/lib/db'
import type { ExerciseProgressEntry, PR, Streak, WeeklyVolumePoint } from '@/lib/db'

const GROUP_COLORS = [
  '#10b981',
  '#f59e0b',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f43f5e',
]

export default function Stats() {
  const { user } = useAuth()
  const [streak, setStreak] = useState<Streak | null>(null)
  const [volume, setVolume] = useState<WeeklyVolumePoint[]>([])
  const [prs, setPrs] = useState<PR[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([
      fetchStreak(user.id),
      fetchWeeklyVolumeSeries(user.id),
      fetchPRs(user.id),
    ])
      .then(([s, v, p]) => {
        if (cancelled) return
        setStreak(s)
        setVolume(v)
        setPrs(p)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Error al cargar estadísticas')
      })
    return () => {
      cancelled = true
    }
  }, [user])

  if (!user) return null

  return (
    <div>
      <header>
        <h1 className="text-xl font-bold tracking-tight">Estadísticas</h1>
        <p className="mt-1 text-sm text-dim2">
          Tu progreso, en números y gráficos.
        </p>
      </header>

      {error && (
        <p className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <section className="mt-6 grid grid-cols-2 gap-3">
        <StreakCard label="Racha actual" value={streak?.current ?? null} />
        <StreakCard label="Mejor racha" value={streak?.best ?? null} />
      </section>

      <VolumeChart volume={volume} />

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-dim">
          Récords personales
        </h2>
        {prs.length === 0 ? (
          <p className="mt-3 rounded-xl border border-edge bg-surface p-4 text-sm text-dim">
            Todavía no hay récords. Registrá sesiones y vas a ver acá tus mejores
            marcas por ejercicio.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {prs.map((pr) => (
              <li key={pr.exerciseId}>
                <Link
                  to={`/ejercicios/${pr.exerciseId}`}
                  className="flex items-center gap-3 rounded-xl border border-edge bg-surface p-3 active:bg-surface2"
                >
                  {pr.imageUrl ? (
                    <img
                      src={pr.imageUrl}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-lg object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <span className="h-11 w-11 shrink-0 rounded-lg bg-surface2" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{pr.name}</p>
                    <p className="mt-0.5 text-xs text-dim2">
                      Máx {pr.maxWeight} kg · {pr.sessions} sesión{pr.sessions === 1 ? '' : 'es'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-emerald-400">
                      {pr.maxOneRm!.toFixed(0)} kg
                    </p>
                    <p className="mt-0.5 text-xs text-dim2">1RM est.</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ExerciseEvolution prs={prs} />
    </div>
  )
}

function StreakCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl border border-edge bg-surface p-4">
      <p className="text-3xl font-bold tracking-tight text-emerald-400">
        {value ?? '—'}
      </p>
      <p className="mt-1 text-xs text-dim2">{label}</p>
    </div>
  )
}

function VolumeChart({ volume }: { volume: WeeklyVolumePoint[] }) {
  const weeks = useMemo(() => {
    const now = new Date()
    const day = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() + (day === 0 ? -6 : 1 - day))
    monday.setHours(0, 0, 0, 0)
    const out: { weekStart: string; groups: Map<string, number> }[] = []
    for (let i = 7; i >= 0; i--) {
      const ws = new Date(monday.getTime() - i * 7 * 86400000)
      out.push({ weekStart: ws.toISOString(), groups: new Map() })
    }
    for (const p of volume) {
      const w = out.find((x) => x.weekStart === p.weekStart)
      if (w) w.groups.set(p.group, (w.groups.get(p.group) ?? 0) + p.sets)
    }
    return out
  }, [volume])

  const groups = useMemo(() => {
    const totals = new Map<string, number>()
    for (const p of volume) {
      const t = totals.get(p.group) ?? 0
      totals.set(p.group, t + p.sets)
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1])
  }, [volume])

  const maxWeekTotal = Math.max(1, ...weeks.map((w) => [...w.groups.values()].reduce((a, b) => a + b, 0)))
  const W = 300
  const H = 110

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-dim">
        Volumen semanal
      </h2>
      {groups.length === 0 ? (
        <p className="mt-3 rounded-xl border border-edge bg-surface p-4 text-sm text-dim">
          Sin series registradas en las últimas 8 semanas.
        </p>
      ) : (
        <>
          <div className="mt-4 rounded-xl border border-edge bg-surface p-4">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
              {weeks.map((w, i) => {
                const colW = W / weeks.length
                const x = i * colW + colW * 0.18
                const bw = colW * 0.64
                let y = H - 8
                const segs: { x: number; y: number; h: number; color: string }[] = []
                for (const [gi, [gname]] of groups.entries()) {
                  const sets = w.groups.get(gname) ?? 0
                  if (sets === 0) continue
                  const h = (sets / maxWeekTotal) * (H - 18)
                  y -= h
                  segs.push({ x, y, h, color: GROUP_COLORS[gi % GROUP_COLORS.length] })
                }
                return (
                  <g key={w.weekStart}>
                    {segs.map((s) => (
                      <rect key={s.y} x={s.x} y={s.y} width={bw} height={s.h} rx={2} fill={s.color} />
                    ))}
                  </g>
                )
              })}
            </svg>
            <div className="mt-2 flex justify-between text-xs text-dim2">
              <span>{formatShortDate(weeks[0].weekStart)}</span>
              <span>semana en curso · {formatShortDate(weeks[7].weekStart)}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
              {groups.map(([gname, total], gi) => (
                <span key={gname} className="flex items-center gap-1.5 text-xs text-soft">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: GROUP_COLORS[gi % GROUP_COLORS.length] }}
                  />
                  {gname} · {total}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

function ExerciseEvolution({ prs }: { prs: PR[] }) {
  const { user } = useAuth()
  const [exerciseId, setExerciseId] = useState('')
  const [seriesByExercise, setSeriesByExercise] = useState<
    Record<string, ExerciseProgressEntry[]>
  >({})

  const series = exerciseId ? seriesByExercise[exerciseId] : undefined
  const loading = exerciseId !== '' && series === undefined

  useEffect(() => {
    if (!exerciseId || !user) return
    let cancelled = false
    fetchExerciseProgress(user.id, exerciseId)
      .then((res) => {
        if (!cancelled) setSeriesByExercise((m) => ({ ...m, [exerciseId]: res }))
      })
      .catch(console.error)
    return () => {
      cancelled = true
    }
  }, [exerciseId, user])

  const selected = prs.find((p) => p.exerciseId === exerciseId)

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-dim">
        Evolución por ejercicio
      </h2>
      {prs.length === 0 ? null : (
        <>
          <select
            value={exerciseId}
            onChange={(e) => {
              setExerciseId(e.target.value)
            }}
            className="mt-3 min-h-11 w-full rounded-lg border border-edge bg-surface px-3 text-sm text-strong"
          >
            <option value="">Elegí un ejercicio…</option>
            {prs.map((p) => (
              <option key={p.exerciseId} value={p.exerciseId}>
                {p.name}
              </option>
            ))}
          </select>

          {loading && <p className="mt-4 text-sm text-dim">Cargando…</p>}

          {!loading && series && series.length < 2 && (
            <p className="mt-4 rounded-xl border border-edge bg-surface p-4 text-sm text-dim">
              Necesitás al menos 2 sesiones con este ejercicio para ver la evolución.
            </p>
          )}

          {!loading && series && series.length >= 2 && selected && (
            <div className="mt-4 rounded-xl border border-edge bg-surface p-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-lg font-bold tracking-tight">
                    {selected.maxWeight} kg
                  </p>
                  <p className="mt-0.5 text-xs text-dim2">Peso máximo</p>
                </div>
                <div>
                  <p className="text-lg font-bold tracking-tight text-emerald-400">
                    {selected.maxOneRm!.toFixed(1)} kg
                  </p>
                  <p className="mt-0.5 text-xs text-dim2">1RM estimado</p>
                </div>
                <div>
                  <p className="text-lg font-bold tracking-tight">
                    {selected.sessions}
                  </p>
                  <p className="mt-0.5 text-xs text-dim2">Sesiones</p>
                </div>
              </div>
              <ProgressChart series={series} />
            </div>
          )}
        </>
      )}
    </section>
  )
}