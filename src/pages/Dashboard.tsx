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

const TARGET_SETS = 10
const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export default function Dashboard() {
  const { user } = useAuth()
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
    if (!iso) return 'Nunca entrenado'
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
    if (days <= 0) return 'Entrenado hoy'
    if (days === 1) return 'Último entrenamiento: ayer'
    return `Último entrenamiento: hace ${days} días`
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Tu resumen semanal</h1>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-sm text-dim">
            Semana del{' '}
            {weekStart.toLocaleDateString('es-AR', {
              day: 'numeric',
              month: 'long',
            })}
          </p>
          {lastWeight && (
            <Link
              to="/perfil"
              className="rounded-full border border-edge bg-surface px-3 py-1 text-xs text-soft transition-colors hover:border-emerald-500/50 hover:text-emerald-400"
            >
              Último peso: {lastWeight.weight} kg
              {lastWeight.date === todayStr ? ' (hoy)' : ''}
            </Link>
          )}
        </div>
      </header>

      {loading ? (
        <div className="space-y-4">
          <div className="h-28 animate-pulse rounded-xl border border-edge bg-surface" />
          <div className="grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl border border-edge bg-surface" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-xl border border-edge bg-surface" />
        </div>
      ) : (
        <div className="space-y-4">
          {nextDayId ? (
            <div className="rounded-xl bg-emerald-500 p-5 text-neutral-950">
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-900/80">
                {activeSession ? 'Sesión en curso' : 'Sugerencia para hoy'}
              </p>
              <h2 className="mt-1 text-xl font-bold">
                {activeSession
                  ? next?.dayId === activeSession.day_id
                    ? next.dayName
                    : 'Retomá donde lo dejaste'
                  : next?.dayName}
              </h2>
              <p className="mt-1 text-sm text-neutral-900/80">
                {activeSession
                  ? 'Hay una sesión activa sin finalizar'
                  : `${next?.routineName} · ${lastTrainedLabel(next?.lastTrainedAt ?? null)}`}
              </p>
              <Link
                to={`/entrenar/${nextDayId}`}
                className="mt-4 inline-block rounded-lg bg-white/90 px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-white"
              >
                {activeSession ? 'Retomar ▶' : 'Entrenar ▶'}
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border border-edge bg-surface p-5">
              <h2 className="font-semibold">Sin sesiones sugeridas</h2>
              <p className="mt-1 text-sm text-dim">
                Creá una rutina con días de entrenamiento para empezar
              </p>
              <Link
                to="/rutinas"
                className="mt-4 inline-block rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-400"
              >
                Ir a mis rutinas
              </Link>
            </div>
          )}

          {sessionsCount === 0 ? (
            <div className="mt-4 text-center">
              <p className="font-medium">Todavía no entrenaste esta semana</p>
              <p className="mt-1 text-sm text-dim">
                Completá una sesión para ver tu volumen semanal por músculo
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <StatCard
                  label="Sesiones completadas"
                  value={sessionsCount}
                  delta={sessionsCount - prevSessionsCount}
                />
                <StatCard
                  label="Series totales"
                  value={totalSets}
                  delta={totalSets - prevTotalSets}
                />
                <StatCard label="Grupos trabajados" value={volume.length} />
              </div>

              <section className="rounded-xl border border-edge bg-surface p-5">
                <h2 className="font-semibold">Series por grupo muscular</h2>
                <p className="mb-4 mt-1 text-xs text-dim2">
                  Objetivo mínimo recomendado: {TARGET_SETS} series semanales por grupo para hipertrofia
                </p>
                {volume.length === 0 ? (
                  <p className="text-sm text-dim">
                    No se registraron series con músculo identificado esta semana.
                  </p>
                ) : (
                  <ul className="space-y-4">
                    {volume.map((m) => {
                      const pct = Math.min(100, (m.sets / TARGET_SETS) * 100)
                      const reached = m.sets >= TARGET_SETS
                      return (
                        <li key={m.group_name}>
                          <div className="mb-1 flex items-baseline justify-between text-sm">
                            <span className="font-medium capitalize">{m.group_name}</span>
                            <span className={reached ? 'text-emerald-400' : 'text-amber-400'}>
                              {m.sets}/{TARGET_SETS} series
                              {!reached && m.sets < TARGET_SETS
                                ? ` · faltan ${TARGET_SETS - m.sets}`
                                : ''}
                            </span>
                          </div>
                          <div className="h-2.5 overflow-hidden rounded-full bg-surface2">
                            <div
                              className={`h-full rounded-full transition-all ${
                                reached ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, delta }: { label: string; value: number; delta?: number }) {
  return (
    <div className="rounded-xl border border-edge bg-surface p-5">
      <p className="text-3xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-sm text-dim">{label}</p>
      {delta !== undefined && delta !== 0 && (
        <p
          className={`mt-1 text-xs font-medium ${
            delta > 0 ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {delta > 0 ? '▲' : '▼'} {Math.abs(delta)} vs semana pasada
        </p>
      )}
    </div>
  )
}