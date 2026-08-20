import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import {
  countSessionsSince,
  fetchActiveSession,
  fetchBodyMetrics,
  fetchSuggestedSession,
  fetchWeeklyMuscleVolume,
} from '@/lib/db'
import type { MuscleVolume, SuggestedSession } from '@/lib/db'
import type { Session } from '@/lib/types'
import { useLang } from '@/lib/lang-context'

const TARGET_SETS = 10
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`card-hairline glass-card rounded-2xl ${className}`}>{children}</div>
  )
}

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`shimmer relative overflow-hidden rounded-2xl border border-edge bg-surface ${className}`} />
  )
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-5 w-5"
    >
      {children}
    </svg>
  )
}

const CheckIcon = (
  <Icon>
    <path d="M20 6 9 17l-5-5" />
  </Icon>
)
const DumbbellIcon = (
  <Icon>
    <path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" />
  </Icon>
)
const TargetIcon = (
  <Icon>
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4" />
  </Icon>
)
const PlayIcon = (
  <Icon>
    <path d="M6 4v16l14-8z" />
  </Icon>
)

export default function Dashboard() {
  const { user } = useAuth()
  const { lang, t } = useLang()
  const [volume, setVolume] = useState<MuscleVolume[]>([])
  const [prevVolume, setPrevVolume] = useState<MuscleVolume[]>([])
  const [sessionsCount, setSessionsCount] = useState(0)
  const [prevSessionsCount, setPrevSessionsCount] = useState(0)
  const [next, setNext] = useState<SuggestedSession | null>(null)
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [lastWeight, setLastWeight] = useState<{ weight: number; date: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const loadingRef = useRef(false)

  const weekStart = useMemo(() => {
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(now)
    monday.setDate(now.getDate() + diff)
    monday.setHours(0, 0, 0, 0)
    return monday
  }, [])

  const lastWeekStart = useMemo(
    () => new Date(weekStart.getTime() - WEEK_MS),
    [weekStart],
  )

  const load = useCallback(async () => {
      if (!user || loadingRef.current) return
      loadingRef.current = true
      try {
        const [v, pv, s, ps, n, act, metrics] = await Promise.all([
          fetchWeeklyMuscleVolume(user.id, weekStart.toISOString()),
          fetchWeeklyMuscleVolume(user.id, lastWeekStart.toISOString()),
          countSessionsSince(user.id, weekStart.toISOString()),
          countSessionsSince(user.id, lastWeekStart.toISOString()),
          fetchSuggestedSession(user.id),
          fetchActiveSession(user.id),
          fetchBodyMetrics(user.id, 1),
        ])
        setVolume(v)
        setPrevVolume(pv)
        setSessionsCount(s)
        setPrevSessionsCount(ps)
        setNext(n)
        setActiveSession(act)
        setLastWeight(
          metrics[0]?.weight_kg != null
            ? { weight: metrics[0].weight_kg, date: metrics[0].date }
            : null,
        )
      } catch (err) {
        console.error(err)
      } finally {
        loadingRef.current = false
        setLoading(false)
      }
    },
    [user, weekStart, lastWeekStart],
  )

  useEffect(() => {
    // eslint-disable-next-line react/set-state-in-effect
    void load()
  }, [load])

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void load()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [load])

  const totalSets = volume.reduce((acc, m) => acc + m.sets, 0)
  const prevTotalSets = prevVolume.reduce((acc, m) => acc + m.sets, 0)
  const todayStr = new Date().toISOString().slice(0, 10)

  const nextDayId = activeSession?.day_id ?? next?.dayId ?? null

  const lastTrainedLabel = (iso: string | null) => {
    if (!iso) return t('dash.neverTrained')
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    if (days <= 0) return t('dash.trainedToday')
    if (days === 1) return t('dash.lastTrainYesterday')
    return t('dash.lastTrainDays', { n: days })
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t('dash.summary')}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-sm text-dim">
            {t('common.week', {
              date: weekStart.toLocaleDateString(
                lang === 'en' ? 'en-US' : 'es-AR',
                { day: 'numeric', month: 'long' },
              ),
            })}
          </p>
          {lastWeight && (
            <Link
              to="/perfil"
              className="rounded-full border border-edge bg-surface px-3 py-1 text-xs text-soft transition-all duration-200 hover:border-edge2 hover:text-strong"
            >
              {t('dash.lastWeight', { weight: lastWeight.weight })}
              {lastWeight.date === todayStr ? t('dash.todayTag') : ''}
            </Link>
          )}
        </div>
      </header>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-28" />
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-72" />
        </div>
      ) : (
        <div className="space-y-4">
          {nextDayId ? (
            <div className="glass-card card-hairline p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-dim">
                {activeSession ? t('dash.sessionActive') : t('dash.suggestion')}
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-high">
                {activeSession
                  ? next?.dayId === activeSession.day_id
                    ? next.dayName
                    : t('dash.resumeWhere')
                  : next?.dayName}
              </h2>
              <p className="mt-1 text-sm text-dim">
                {activeSession
                  ? t('dash.activeSessionNote')
                  : `${next?.routineName} · ${lastTrainedLabel(next?.lastTrainedAt ?? null)}`}
              </p>
              <Link
                to={`/entrenar/${nextDayId}`}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-neutral-950 shadow-[0_4px_20px_rgba(16,185,129,0.35)] transition-all duration-200 hover:bg-emerald-400 hover:shadow-[0_4px_32px_rgba(16,185,129,0.55)] active:scale-[0.98]"
              >
                {PlayIcon}
                {activeSession ? t('dash.resume') : t('dash.train')}
              </Link>
            </div>
          ) : (
            <Card className="p-5">
              <h2 className="font-semibold">{t('dash.noSuggested')}</h2>
              <p className="mt-1 text-sm text-dim">{t('dash.noSuggestedHint')}</p>
              <Link
                to="/rutinas"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 shadow-[0_4px_20px_rgba(16,185,129,0.35)] transition-all duration-200 hover:bg-emerald-400 active:scale-[0.98]"
              >
                {t('dash.goRoutines')}
              </Link>
            </Card>
          )}

          {sessionsCount === 0 ? (
            <div className="mt-4 text-center">
              <p className="font-medium">{t('dash.noTrainWeek')}</p>
              <p className="mt-1 text-sm text-dim">{t('dash.noTrainWeekHint')}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                <StatCard
                  label={t('dash.sessionsDone')}
                  value={sessionsCount}
                  delta={sessionsCount - prevSessionsCount}
                  icon={CheckIcon}
                />
                <StatCard
                  label={t('dash.totalSets')}
                  value={totalSets}
                  delta={totalSets - prevTotalSets}
                  icon={DumbbellIcon}
                />
                <StatCard label={t('dash.groupsWorked')} value={volume.length} icon={TargetIcon} />
              </div>

              <Card className="p-5">
                <h2 className="font-semibold">{t('dash.volumeByGroup')}</h2>
                <p className="mb-4 mt-1 text-xs text-dim2">
                  {t('dash.targetHint', { n: TARGET_SETS })}
                </p>
                {volume.length === 0 ? (
                  <p className="text-sm text-dim">{t('dash.noVolume')}</p>
                ) : (
                  <ul className="space-y-4">
                    {volume.map((m) => {
                      const pct = Math.min(100, (m.sets / TARGET_SETS) * 100)
                      const reached = m.sets >= TARGET_SETS
                      return (
                        <li key={m.group_name}>
                          <div className="mb-1 flex items-baseline justify-between text-sm">
                            <span className="font-medium capitalize text-high">{t(`group.${m.group_name}`)}</span>
                            <span
                              className={`font-mono tabular-nums ${
                                reached ? 'text-emerald-400' : 'text-amber-400'
                              }`}
                            >
                              {m.sets}/{TARGET_SETS} {t('dash.setsShort')}
                              {!reached && m.sets < TARGET_SETS
                                ? ` · ${t('dash.missing', { n: TARGET_SETS - m.sets })}`
                                : ''}
                            </span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-surface2/80 ring-1 ring-inset ring-edge">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ease-out ${
                                reached
                                  ? 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400'
                                  : 'bg-gradient-to-r from-amber-600 to-amber-400'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  delta,
  icon,
}: {
  label: string
  value: number
  delta?: number
  icon: React.ReactNode
}) {
  const { t } = useLang()
  return (
    <div className="card-hairline glass-card rounded-2xl p-3">
      <div className="flex items-center justify-between gap-1.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface2 text-dim ring-1 ring-inset ring-edge">
          {icon}
        </span>
        <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
      </div>
      <p className="mt-1.5 text-[11px] leading-tight text-dim">{label}</p>
      {delta !== undefined && delta !== 0 && (
        <p
          className={`mt-1 text-[10px] font-medium ${
            delta > 0 ? 'text-soft' : 'text-red-400'
          }`}
        >
          {delta > 0 ? '▲' : '▼'} {Math.abs(delta)} {t('dash.vsPrev')}
        </p>
      )}
    </div>
  )
}