import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import { ProgressChart } from '@/components/ProgressChart'
import { formatShortDate } from '@/lib/format'
import {
  fetchExerciseProgress,
  fetchPRs,
  fetchStreak,
  fetchWeeklyVolumeSeries,
} from '@/lib/db'
import type { ExerciseProgressEntry, PR, Streak, WeeklyVolumePoint } from '@/lib/db'
import { useLang } from '@/lib/lang-context'
import { displayName } from '@/lib/i18n'

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
  const { lang, t } = useLang()
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
        if (!cancelled) setError(e instanceof Error ? e.message : t('stats.loadError'))
      })
    return () => {
      cancelled = true
    }
  }, [user, t])

  if (!user) return null

  return (
    <div>
      <header>
        <h1 className="text-xl font-bold tracking-tight">{t('stats.title')}</h1>
        <p className="mt-1 text-sm text-dim2">{t('stats.subtitle')}</p>
      </header>

      {error && (
        <p className="mt-4 rounded-lg border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-400">
          {error}
        </p>
      )}

      <section className="mt-6 grid grid-cols-2 gap-3">
        <StreakCard label={t('stats.currentStreak')} value={streak?.current ?? null} />
        <StreakCard label={t('stats.bestStreak')} value={streak?.best ?? null} />
      </section>

      <VolumeChart volume={volume} lang={lang} t={t} />

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-dim">
          {t('stats.prs')}
        </h2>
        {prs.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-edge bg-surface p-4 text-sm text-dim">
            {t('stats.noPrs')}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {prs.map((pr) => (
              <li key={pr.exerciseId}>
                <Link
                  to={`/ejercicios/${pr.exerciseId}`}
                  className="glass-card card-hairline flex items-center gap-3 rounded-2xl p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/40 active:bg-surface2"
                >
                  {pr.imageUrl ? (
                    <img
                      src={pr.imageUrl}
                      alt=""
                      className="h-11 w-11 shrink-0 rounded-xl object-cover ring-1 ring-inset ring-edge"
                      loading="lazy"
                    />
                  ) : (
                    <span className="h-11 w-11 shrink-0 rounded-xl bg-surface2" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-high">
                      {displayName(pr, lang)}
                    </p>
                    <p className="mt-0.5 text-xs text-dim2">
                      {t('stats.max', {
                        n: String(pr.maxWeight ?? '—'),
                        s: pr.sessions,
                        es: pr.sessions === 1 ? '' : 'es',
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-bold tabular-nums text-strong">
                      {pr.maxOneRm!.toFixed(0)} kg
                    </p>
                    <p className="mt-0.5 text-xs text-dim2">{t('stats.estOneRm')}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ExerciseEvolution prs={prs} lang={lang} t={t} />
    </div>
  )
}

function StreakCard({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="card-hairline glass-card rounded-2xl p-4">
      <p className="font-mono text-3xl font-bold tracking-tight tabular-nums text-strong">
        {value ?? '—'}
      </p>
      <p className="mt-1 text-xs text-dim2">{label}</p>
    </div>
  )
}

function VolumeChart({
  volume,
  lang,
  t,
}: {
  volume: WeeklyVolumePoint[]
  lang: 'es' | 'en'
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
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
        {t('stats.weeklyVolume')}
      </h2>
      {groups.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-edge bg-surface p-4 text-sm text-dim">
          {t('stats.noVolume')}
        </p>
      ) : (
        <>
          <div className="glass-card card-hairline mt-4 rounded-2xl p-4">
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
              <span>{formatShortDate(weeks[0].weekStart, lang)}</span>
              <span>{t('stats.currentWeek', { date: formatShortDate(weeks[7].weekStart, lang) })}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
              {groups.map(([gname, total], gi) => (
                <span key={gname} className="flex items-center gap-1.5 text-xs text-soft">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: GROUP_COLORS[gi % GROUP_COLORS.length] }}
                  />
                  {t(`group.${gname}`)} · {total}
                </span>
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  )
}

function ExerciseEvolution({
  prs,
  lang,
  t,
}: {
  prs: PR[]
  lang: 'es' | 'en'
  t: (key: string, vars?: Record<string, string | number>) => string
}) {
  const { user } = useAuth()
  const { pushToast } = useToast()
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
      .catch((err) => {
        console.error(err)
        if (!cancelled) pushToast('error', t('stats.evolutionError'))
      })
    return () => {
      cancelled = true
    }
  }, [exerciseId, user, pushToast, t])

  const selected = prs.find((p) => p.exerciseId === exerciseId)

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-dim">
        {t('stats.evolution')}
      </h2>
      {prs.length === 0 ? null : (
        <>
          <select
            value={exerciseId}
            onChange={(e) => {
              setExerciseId(e.target.value)
            }}
            className="mt-3 min-h-11 w-full rounded-xl border border-edge bg-surface px-3 text-sm text-strong outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          >
            <option value="">{t('stats.pickExercise')}</option>
            {prs.map((p) => (
              <option key={p.exerciseId} value={p.exerciseId}>
                {displayName(p, lang)}
              </option>
            ))}
          </select>

          {loading && <p className="mt-4 text-sm text-dim">{t('stats.loading')}</p>}

          {!loading && series && series.length < 2 && (
            <p className="mt-4 rounded-2xl border border-edge bg-surface p-4 text-sm text-dim">
              {t('stats.needTwo')}
            </p>
          )}

          {!loading && series && series.length >= 2 && selected && (
            <div className="glass-card card-hairline mt-4 rounded-2xl p-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-lg font-bold tracking-tight tabular-nums">
                    {selected.maxWeight} kg
                  </p>
                  <p className="mt-0.5 text-xs text-dim2">{t('stats.maxWeight')}</p>
                </div>
                <div>
                  <p className="text-lg font-bold tracking-tight tabular-nums text-strong">
                    {selected.maxOneRm!.toFixed(1)} kg
                  </p>
                  <p className="mt-0.5 text-xs text-dim2">{t('stats.estOneRm2')}</p>
                </div>
                <div>
                  <p className="text-lg font-bold tracking-tight">
                    {selected.sessions}
                  </p>
                  <p className="mt-0.5 text-xs text-dim2">{t('stats.sessions')}</p>
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