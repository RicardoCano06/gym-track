import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import { fetchExportData, fetchSessionSetsWithExercises, fetchSessions } from '@/lib/db'
import ErrorState from '@/components/ErrorState'
import type { ExportRow } from '@/lib/db'
import type { Session, SessionSet } from '@/lib/types'
import { useLang } from '@/lib/lang-context'
import { displayName } from '@/lib/i18n'

type SessionWithMeta = Session & {
  routine_days: { name: string | null; day_number: number } | null
  routines: { name: string } | null
}

function feelingEmoji(f: number | null) {
  if (f === null) return '—'
  if (f >= 9) return '😁'
  if (f >= 7) return '🙂'
  if (f >= 5) return '😐'
  return '😩'
}

function escapeCell(value: string): string {
  return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function buildCSV(rows: ExportRow[], t: (key: string) => string, lang: 'es' | 'en'): string {
  const header = [
    t('history.csvHeader.Fecha'),
    t('history.csvHeader.Hora'),
    t('history.csvHeader.Rutina'),
    t('history.csvHeader.Dia'),
    t('history.csvHeader.Ejercicio'),
    t('history.csvHeader.Serie'),
    t('history.csvHeader.Peso_kg'),
    t('history.csvHeader.Reps'),
    t('history.csvHeader.RPE'),
    t('history.csvHeader.Sensacion'),
    t('history.csvHeader.Duracion_min'),
  ]
  const locale = lang === 'en' ? 'en-US' : 'es-AR'
  const lines = [header.join(';')]
  for (const r of rows) {
    const date = new Date(r.started_at)
    lines.push(
      [
        date.toLocaleDateString(locale),
        date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
        r.routine_name ?? '',
        r.day_name ?? '',
        (lang === 'en' && r.exercise_name_en ? r.exercise_name_en : r.exercise_name) ?? '',
        r.set_number ?? '',
        r.weight_kg ?? '',
        r.reps ?? '',
        r.rpe ?? '',
        r.feeling ?? '',
        r.duration_minutes ?? '',
      ]
        .map((v) => escapeCell(String(v)))
        .join(';'),
    )
  }
  return lines.join('\n')
}

function groupBy<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const groups: Record<string, T[]> = {}
  for (const item of items) {
    const k = key(item)
    ;(groups[k] ??= []).push(item)
  }
  return groups
}

function dateHeaderKey(iso: string): string {
  return iso.slice(0, 10)
}

function formatDateHeader(key: string, t: (k: string) => string, lang: 'es' | 'en'): string {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const date = new Date(key + 'T00:00:00')
  const diffDays = Math.round((today.getTime() - date.getTime()) / 86400000)
  if (diffDays === 0) return t('common.today')
  if (diffDays === 1) return t('common.yesterday')
  return date.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-AR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export default function History() {
  const { user } = useAuth()
  const { pushToast } = useToast()
  const { lang, t } = useLang()
  const [sessions, setSessions] = useState<SessionWithMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(() => {
    if (!user) return
    setError(null)
    setLoading(true)
    fetchSessions(user.id)
      .then(setSessions)
      .catch((err) => {
        console.error(err)
        setError(t('history.loadError'))
      })
      .finally(() => setLoading(false))
  }, [user, t])

  useEffect(() => {
    load()
  }, [load])

  async function handleExport() {
    if (!user || exporting) return
    setExporting(true)
    try {
      const rows = await fetchExportData(user.id)
      const csv = buildCSV(rows, t, lang)
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `vekt-historial-${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error(err)
      pushToast('error', t('history.exportError'))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div>
      <header className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('history.title')}</h1>
            <p className="mt-1 text-sm text-dim">
              {sessions.length > 0
                ? sessions.length === 1
                  ? t('history.subtitleOne', { n: sessions.length })
                  : t('history.subtitleMany', { n: sessions.length })
                : t('history.subtitleEmpty')}
            </p>
          </div>
          {sessions.length > 0 && (
            <button
              onClick={handleExport}
              disabled={exporting}
              className="rounded-lg border border-edge bg-surface px-4 py-2 text-sm font-medium text-dim transition-all duration-200 hover:border-emerald-500 hover:text-emerald-400 active:scale-[0.98] disabled:opacity-50"
            >
              {exporting ? t('history.exporting') : t('history.export')}
            </button>
          )}
        </div>
      </header>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="shimmer h-20 rounded-2xl border border-edge bg-surface" />
          ))}
        </div>
      ) : sessions.length === 0 ? (
        <div className="mt-16 text-center">
          <div className="text-5xl">🕐</div>
          <p className="mt-4 font-medium">{t('history.empty')}</p>
          <p className="mt-1 text-sm text-dim">{t('history.emptyHint')}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(
            groupBy(sessions, (s) => dateHeaderKey(s.started_at)),
          )
            .sort(([a], [b]) => (a < b ? 1 : -1))
            .map(([dateKey, daySessions]) => (
              <div key={dateKey}>
                <p className="px-1 pb-2 text-xs font-semibold uppercase tracking-wider text-dim2">
                  {formatDateHeader(dateKey, t, lang)}
                </p>
                <div className="space-y-3">
                  {daySessions.map((session) => (
                    <SessionCard key={session.id} session={session} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}

function SessionCard({ session }: { session: SessionWithMeta }) {
  const { pushToast } = useToast()
  const { lang, t } = useLang()
  const [open, setOpen] = useState(false)
  const [sets, setSets] = useState<
    (SessionSet & { exercises: { id: string; name: string; image_url: string | null } })[]
  >([])
  const [loadingSets, setLoadingSets] = useState(false)

  async function toggle() {
    if (open) {
      setOpen(false)
      return
    }
    setOpen(true)
    if (sets.length === 0) {
      setLoadingSets(true)
      try {
        const rows = await fetchSessionSetsWithExercises(session.id)
        setSets(rows)
      } catch (err) {
        console.error(err)
        pushToast('error', t('history.setsLoadError'))
      } finally {
        setLoadingSets(false)
      }
    }
  }

  const date = new Date(session.started_at)
  const locale = lang === 'en' ? 'en-US' : 'es-AR'
  const dayName =
    session.routine_days?.name ??
    (session.routine_days ? t('day.number', { n: session.routine_days.day_number }) : '')
  const duration = session.duration_minutes
    ? `${Math.floor(session.duration_minutes / 60)}h ${session.duration_minutes % 60}m`
    : '—'

  return (
    <div className="glass-card card-hairline overflow-hidden rounded-2xl">
      <button onClick={toggle} className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-surface2/40">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">
            {dayName}
            {session.routines?.name && (
              <span className="ml-2 text-xs font-normal text-dim2">
                {session.routines.name}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-dim2">
            {date.toLocaleDateString(locale, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}{' '}
            · {date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-dim">⏱ {duration}</span>
          <span className="w-6 text-center text-lg">{feelingEmoji(session.feeling)}</span>
          <span
            className={`text-dim2 transition-transform ${open ? 'rotate-180' : ''}`}
          >
            ▾
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-edge">
          {loadingSets ? (
            <p className="px-4 py-6 text-center text-sm text-dim2">{t('history.loadingSets')}</p>
          ) : sets.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-dim2">
              {t('history.noSets')}
            </p>
          ) : (
            <div className="divide-y divide-edge/60">
              {Object.entries(groupBy(sets, (s) => s.exercise_id)).map(([exerciseId, rows]) => {
                const ex = (rows ?? [])[0]?.exercises
                return (
                  <div key={exerciseId} className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {ex?.image_url && (
                        <img
                          src={ex.image_url}
                          alt=""
                          className="h-8 w-8 rounded-md object-cover"
                        />
                      )}
                      <p className="text-sm font-medium">{ex ? displayName(ex, lang) : t('history.exercise')}</p>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {rows.map((s) => (
                        <span
                          key={s.id}
className={`rounded-md px-2 py-1 font-mono text-xs tabular-nums ${
  s.completed
    ? 'bg-surface2 text-soft ring-1 ring-inset ring-edge'
    : 'bg-surface2 text-dim2 line-through'
}`}
                        >
                          {s.weight_kg !== null ? `${s.weight_kg}kg × ${s.reps ?? '-'}` : t('history.repsOnly', { n: s.reps ?? '-' })}
                          {s.rpe !== null && ` · RPE ${s.rpe}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          {session.notes && (
            <p className="border-t border-edge px-4 py-3 text-sm text-dim">
              📝 {session.notes}
            </p>
          )}
        </div>
      )}
    </div>
  )
}