import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { ProgressChart } from '@/components/ProgressChart'
import { formatShortDate } from '@/lib/format'
import { fetchExerciseDetail, fetchExerciseProgress } from '@/lib/db'
import type { ExerciseProgressEntry } from '@/lib/db'
import type { Equipment, Exercise, Muscle } from '@/lib/types'
import { displayName, localizedName } from '@/lib/i18n'
import { useLang } from '@/lib/lang-context'

export default function ExerciseDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const { lang, t } = useLang()
  const [detail, setDetail] = useState<{
    exercise: Exercise
    muscles: Muscle[]
    equipment: Equipment | null
  } | null>(null)
  const [progress, setProgress] = useState<ExerciseProgressEntry[] | null>(null)
  const loading = !id || !detail || detail.exercise.id !== id

  useEffect(() => {
    if (!id) return
    let cancelled = false
    fetchExerciseDetail(id)
      .then((res) => {
        if (!cancelled) setDetail(res)
      })
      .catch(console.error)
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!id || !user) return
    let cancelled = false
    fetchExerciseProgress(user.id, id)
      .then((list) => {
        if (!cancelled) setProgress(list)
      })
      .catch(console.error)
    return () => {
      cancelled = true
    }
  }, [id, user])

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="shimmer h-4 w-24 rounded bg-surface2" />
        <div className="shimmer aspect-video rounded-2xl bg-surface2" />
        <div className="shimmer h-8 w-2/3 rounded bg-surface2" />
        <div className="shimmer h-4 w-1/3 rounded bg-surface2" />
      </div>
    )
  }

  const { exercise, muscles, equipment } = detail!

  if (!exercise) {
    return (
      <div className="mt-16 text-center">
        <div className="text-5xl">🤔</div>
        <p className="mt-4 font-medium">{t('detail.notFound')}</p>
        <Link
          to="/ejercicios"
          className="mt-4 inline-block text-sm text-emerald-400 hover:underline"
        >
          {t('detail.backCatalog')}
        </Link>
      </div>
    )
  }

  const primary = muscles.find((m) => m.id === exercise.muscle_primary)
  const secondary = muscles.filter((m) => m.id !== exercise.muscle_primary)
  const instructions =
    (lang === 'es' && exercise.instructions_es?.length
      ? exercise.instructions_es
      : exercise.instructions) ?? []

  const perSession = new Map<string, ExerciseProgressEntry>()
  for (const entry of progress ?? []) {
    const prev = perSession.get(entry.session_id)
    const prevWeight = prev?.weight_kg ?? 0
    const entryWeight = entry.weight_kg ?? 0
    if (
      !prev ||
      entryWeight > prevWeight ||
      (entryWeight === prevWeight && (entry.reps ?? 0) > (prev.reps ?? 0))
    ) {
      perSession.set(entry.session_id, entry)
    }
  }
  const series = [...perSession.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-12)
  const maxWeight = Math.max(0, ...(progress ?? []).map((e) => e.weight_kg ?? 0))
  const maxOneRm = Math.max(
    0,
    ...(progress ?? [])
      .filter((e) => e.weight_kg && e.reps && e.reps > 1)
      .map((e) => e.weight_kg! * (1 + e.reps! / 30)),
  )

  return (
    <div>
      <Link
        to="/ejercicios"
        className="mb-4 inline-flex items-center gap-1 text-sm text-dim transition-colors hover:text-emerald-400"
      >
        {t('detail.backCatalog')}
      </Link>

      {exercise.image_url && (
        <img
          src={exercise.image_url}
          alt={exercise.name}
          className="aspect-video w-full rounded-2xl border border-edge object-cover shadow-[0_20px_50px_-24px_rgba(0,0,0,0.8)]"
        />
      )}

      <div className="mt-6">
        <h1 className="text-3xl font-bold tracking-tight">
          {displayName(exercise, lang)}
        </h1>
        {exercise.name_en &&
          exercise.name_en !== exercise.name && (
            <p className="mt-1 text-sm text-dim2">
              {lang === 'en' ? exercise.name : exercise.name_en}
            </p>
          )}

        <div className="mt-4 flex flex-wrap gap-2">
          {exercise.category && (
            <span className="rounded-full border border-edge bg-surface px-3 py-1 text-xs font-medium text-soft">
              {t(`cat.${exercise.category}`)}
            </span>
          )}
          {equipment && (
            <span className="rounded-full border border-edge bg-surface px-3 py-1 text-xs font-medium text-soft">
              {localizedName(equipment.name, lang)}
            </span>
          )}
          {exercise.level && (
            <span className="rounded-full border border-edge bg-surface px-3 py-1 text-xs font-medium text-soft">
              {t(`level.${exercise.level}`)}
            </span>
          )}
          {exercise.force && (
            <span className="rounded-full border border-edge bg-surface px-3 py-1 text-xs font-medium text-soft">
              {t(`force.${exercise.force}`)}
            </span>
          )}
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-dim">
          {t('detail.musclesWorked')}
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {primary && (
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-400">
              {t('common.principal', { name: localizedName(primary.name, lang) })}
            </span>
          )}
          {secondary.map((m) => (
            <span
              key={m.id}
              className="rounded-full border border-edge bg-surface px-3 py-1.5 text-sm text-soft"
            >
              {localizedName(m.name, lang)}
            </span>
          ))}
          {!primary && secondary.length === 0 && (
            <span className="text-sm text-dim2">{t('detail.noMuscleData')}</span>
          )}
        </div>
      </section>

      {instructions.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-dim">
            {t('detail.howTo')}
          </h2>
          <ol className="mt-3 space-y-3">
            {instructions.map((step, i) => (
              <li key={i} className="flex gap-3 text-sm leading-relaxed text-soft">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface2 text-[11px] font-bold text-emerald-400">
                  {i + 1}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {progress && (
        <section className="card-hairline glass-card mt-8 rounded-2xl p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-dim">
            {t('detail.yourProgress')}
          </h2>
          {progress.length === 0 ? (
            <p className="mt-3 text-sm text-dim">{t('detail.noProgress')}</p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <Stat label={t('detail.maxWeight')} value={maxWeight ? `${maxWeight} kg` : '—'} />
                <Stat label={t('detail.estOneRm')} value={maxOneRm ? `${maxOneRm.toFixed(1)} kg` : '—'} />
                <Stat label={t('detail.sessions')} value={String(perSession.size)} />
              </div>

              {series.length >= 2 && <ProgressChart series={series} />}

              <ul className="mt-4 divide-y divide-edge">
                {[...perSession.values()]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 6)
                  .map((e) => (
                    <li key={e.session_id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-dim">{formatShortDate(e.date, lang)}</span>
                      <span className="font-medium">
                        {e.weight_kg ? `${e.weight_kg} kg` : t('detail.bodyweight')} × {e.reps ?? '—'}
                        {e.rpe ? ` · RPE ${e.rpe}` : ''}
                      </span>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </section>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-edge bg-bg/50 p-3">
      <p className="font-mono text-lg font-bold tracking-tight tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-dim2">{label}</p>
    </div>
  )
}