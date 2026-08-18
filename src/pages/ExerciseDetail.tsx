import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { categories, forces, levels } from '@/lib/catalog'
import { ProgressChart } from '@/components/ProgressChart'
import { formatShortDate } from '@/lib/format'
import { fetchExerciseDetail, fetchExerciseProgress } from '@/lib/db'
import type { ExerciseProgressEntry } from '@/lib/db'
import type { Equipment, Exercise, Muscle } from '@/lib/types'

export default function ExerciseDetail() {
  const { id } = useParams()
  const { user } = useAuth()
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
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-24 rounded bg-surface2" />
        <div className="aspect-video rounded-xl bg-surface2" />
        <div className="h-8 w-2/3 rounded bg-surface2" />
        <div className="h-4 w-1/3 rounded bg-surface2" />
      </div>
    )
  }

  const { exercise, muscles, equipment } = detail!

  if (!exercise) {
    return (
      <div className="mt-16 text-center">
        <div className="text-5xl">🤔</div>
        <p className="mt-4 font-medium">No se encontró el ejercicio</p>
        <Link
          to="/ejercicios"
          className="mt-4 inline-block text-sm text-emerald-400 hover:underline"
        >
          ← Volver al catálogo
        </Link>
      </div>
    )
  }

  const primary = muscles.find((m) => m.id === exercise.muscle_primary)
  const secondary = muscles.filter((m) => m.id !== exercise.muscle_primary)

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
        ← Volver al catálogo
      </Link>

      {exercise.image_url && (
        <img
          src={exercise.image_url}
          alt={exercise.name}
          className="aspect-video w-full rounded-xl border border-edge object-cover"
        />
      )}

      <div className="mt-6">
        <h1 className="text-3xl font-bold tracking-tight">{exercise.name}</h1>
        {exercise.name_en && exercise.name_en !== exercise.name && (
          <p className="mt-1 text-sm text-dim2">{exercise.name_en}</p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {exercise.category && (
            <span className="rounded-full border border-edge bg-surface px-3 py-1 text-xs font-medium text-soft">
              {categories[exercise.category] ?? exercise.category}
            </span>
          )}
          {equipment && (
            <span className="rounded-full border border-edge bg-surface px-3 py-1 text-xs font-medium text-soft">
              {equipment.name}
            </span>
          )}
          {exercise.level && (
            <span className="rounded-full border border-edge bg-surface px-3 py-1 text-xs font-medium text-soft">
              {levels[exercise.level] ?? exercise.level}
            </span>
          )}
          {exercise.force && (
            <span className="rounded-full border border-edge bg-surface px-3 py-1 text-xs font-medium text-soft">
              {forces[exercise.force] ?? exercise.force}
            </span>
          )}
        </div>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-dim">
          Músculos trabajados
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {primary && (
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-400">
              {primary.name} · principal
            </span>
          )}
          {secondary.map((m) => (
            <span
              key={m.id}
              className="rounded-full border border-edge bg-surface px-3 py-1.5 text-sm text-soft"
            >
              {m.name}
            </span>
          ))}
          {!primary && secondary.length === 0 && (
            <span className="text-sm text-dim2">Sin datos de músculos</span>
          )}
        </div>
      </section>

      {exercise.instructions && exercise.instructions.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-dim">
            Cómo hacerlo
          </h2>
          <ol className="mt-3 space-y-3">
            {exercise.instructions.map((step, i) => (
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
        <section className="mt-8 rounded-xl border border-edge bg-surface p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-dim">
            Tu progreso
          </h2>
          {progress.length === 0 ? (
            <p className="mt-3 text-sm text-dim">
              Todavía no registraste series de este ejercicio. Entrenalo en una sesión
              y vas a ver tu evolución acá.
            </p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <Stat label="Peso máximo" value={maxWeight ? `${maxWeight} kg` : '—'} />
                <Stat label="1RM estimado" value={maxOneRm ? `${maxOneRm.toFixed(1)} kg` : '—'} />
                <Stat label="Sesiones" value={String(perSession.size)} />
              </div>

              {series.length >= 2 && <ProgressChart series={series} />}

              <ul className="mt-4 divide-y divide-edge">
                {[...perSession.values()]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .slice(0, 6)
                  .map((e) => (
                    <li key={e.session_id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-dim">{formatShortDate(e.date)}</span>
                      <span className="font-medium">
                        {e.weight_kg ? `${e.weight_kg} kg` : 'Peso corporal'} × {e.reps ?? '—'}
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
    <div className="rounded-lg border border-edge bg-bg/50 p-3">
      <p className="text-lg font-bold tracking-tight">{value}</p>
      <p className="mt-0.5 text-xs text-dim2">{label}</p>
    </div>
  )
}