import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SwipeRow from '@/components/SwipeRow'
import { useConfirm } from '@/lib/use-confirm'
import { WEEKDAYS } from '@/lib/constants'
import { fetchExercisesByGroup } from '@/lib/db'
import type { Exercise, RoutineDay, RoutineExercise } from '@/lib/types'

interface DayCardProps {
  day: RoutineDay
  groups: string[]
  onUpdateDay: (patch: Partial<Pick<RoutineDay, 'name' | 'weekday' | 'goal'>>) => void
  onDelete: () => void
  onAddExercise: (day: RoutineDay, exercise: Exercise) => void
  onRemoveExercise: (re: RoutineExercise) => void
  onUpdateExercise: (
    re: RoutineExercise,
    patch: Partial<Pick<RoutineExercise, 'sets' | 'reps' | 'rest_seconds' | 'superset_group'>>,
  ) => void
  onToggleSuperset: (re: RoutineExercise, index: number) => void
  onOpenOverlay: (day: RoutineDay) => void
}

export default function DayCard({
  day,
  groups,
  onUpdateDay,
  onDelete,
  onAddExercise,
  onRemoveExercise,
  onUpdateExercise,
  onToggleSuperset,
  onOpenOverlay,
}: DayCardProps) {
  const { ask, dialog } = useConfirm()
  const [editingName, setEditingName] = useState(false)
  const [editingSettings, setEditingSettings] = useState(false)
  const [name, setName] = useState(day.name ?? '')
  const [weekday, setWeekday] = useState(day.weekday ?? '')
  const [goal, setGoal] = useState(day.goal ?? '')
  const [busy, setBusy] = useState(false)
  const [recommended, setRecommended] = useState<{
    group: string
    list: Exercise[]
  } | null>(null)

  useEffect(() => {
    const group = day.goal
    if (!group) return
    let cancelled = false
    fetchExercisesByGroup(group, 20)
      .then((list) => {
        if (!cancelled) setRecommended({ group, list })
      })
      .catch(console.error)
    return () => {
      cancelled = true
    }
  }, [day.goal])

  async function saveName() {
    setEditingName(false)
    if (busy) return
    setBusy(true)
    try {
      if (name.trim() && name !== day.name) await onUpdateDay({ name: name.trim() })
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  async function saveSettings() {
    setEditingSettings(false)
    if (busy) return
    setBusy(true)
    try {
      await onUpdateDay({
        weekday: weekday || null,
        goal: goal || null,
      })
    } catch (err) {
      console.error(err)
    } finally {
      setBusy(false)
    }
  }

  const alreadyAdded = new Set((day.exercises ?? []).map((re) => re.exercise_id))
  const recsToShow =
    day.goal && recommended?.group === day.goal
      ? recommended.list.filter((ex) => !alreadyAdded.has(ex.id)).slice(0, 6)
      : []
  const exCount = day.exercises?.length ?? 0

  return (
    <section className="relative overflow-hidden rounded-2xl border border-edge bg-surface">
      <div className="px-5 pt-5 pb-4">
        {editingName ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === 'Enter' && saveName()}
            className="w-full rounded-lg border border-emerald-500/50 bg-bg px-3 py-2 text-lg font-bold outline-none"
          />
        ) : (
          <button
            onClick={() => {
              setName(day.name ?? '')
              setEditingName(true)
            }}
            className="flex w-full items-center gap-2 text-left"
            title="Renombrar día"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-xs font-bold text-emerald-400">
              {day.day_number}
            </span>
            <h3 className="text-lg font-bold tracking-tight">
              {day.name ?? `Día ${day.day_number}`}
            </h3>
            <span className="text-xs text-dim2">✎</span>
          </button>
        )}

        {day.weekday && (
          <span className="mt-2 inline-block rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs text-emerald-400">
            {day.weekday.charAt(0).toUpperCase() + day.weekday.slice(1)}
          </span>
        )}

        {editingSettings && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-edge bg-bg/50 p-3">
            <select
              value={weekday}
              onChange={(e) => setWeekday(e.target.value)}
              onBlur={saveSettings}
              autoFocus
              className="rounded-lg border border-edge2 bg-surface px-3 py-2 text-sm outline-none focus:border-emerald-500"
            >
              <option value="">Sin día fijo</option>
              {WEEKDAYS.map((w) => (
                <option key={w} value={w}>
                  {w.charAt(0).toUpperCase() + w.slice(1)}
                </option>
              ))}
            </select>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onBlur={saveSettings}
              className="rounded-lg border border-edge2 bg-surface px-3 py-2 text-sm outline-none focus:border-emerald-500"
            >
              <option value="">Sin grupo muscular</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </option>
              ))}
            </select>
            <p className="text-xs text-dim2">Guardado al salir</p>
          </div>
        )}
      </div>

      {exCount > 0 ? (
        <ul className="divide-y divide-edge">
          {(day.exercises ?? []).map((re, index) => (
            <ExerciseRow
              key={re.id}
              item={re}
              canPair={index < exCount - 1}
              onRemove={() => onRemoveExercise(re)}
              onUpdate={(patch) => onUpdateExercise(re, patch)}
              onToggleSuperset={() => onToggleSuperset(re, index)}
            />
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
          <svg
            viewBox="0 0 48 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="h-12 w-24 text-dim2"
          >
            <rect x="2" y="4" width="8" height="16" rx="2" />
            <rect x="38" y="4" width="8" height="16" rx="2" />
            <rect x="10" y="9" width="28" height="6" rx="1" />
          </svg>
          <p className="text-sm font-medium text-soft">Ejercicios</p>
          <p className="text-xs text-dim2">Agregá ejercicios a tu rutina</p>
          <button
            onClick={() => onOpenOverlay(day)}
            className="mt-1 flex min-h-11 items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/5"
          >
            <span className="text-lg leading-none">+</span> Agregar ejercicios
          </button>
        </div>
      )}

      {day.goal && recsToShow.length > 0 && (
        <div className="border-t border-edge bg-bg/40 px-4 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-dim2">
            Recomendados para {day.goal.charAt(0).toUpperCase() + day.goal.slice(1)}
          </p>
          <ul className="divide-y divide-edge/70">
            {recsToShow.map((ex) => (
              <li key={ex.id} className="flex items-center gap-3 py-1.5">
                {ex.image_url && (
                  <img
                    src={ex.image_url}
                    alt=""
                    loading="lazy"
                    className="h-9 w-9 shrink-0 rounded-md object-cover"
                  />
                )}
                <button
                  onClick={() => onAddExercise(day, ex)}
                  className="min-w-0 flex-1 truncate text-left text-sm text-soft transition-colors hover:text-emerald-400"
                  title="Agregar a este día"
                >
                  {ex.name}
                </button>
                <button
                  onClick={() => onAddExercise(day, ex)}
                  className="flex min-h-11 shrink-0 items-center rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500 hover:text-neutral-950"
                >
                  + Agregar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-edge px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => {
                setWeekday(day.weekday ?? '')
                setGoal(day.goal ?? '')
                setEditingSettings(true)
              }}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xs text-dim2 transition-colors hover:bg-surface2 hover:text-high"
              title="Editar día"
            >
              ⚙
            </button>
            <button
              onClick={() =>
                ask({
                  title: 'Eliminar día',
                  message: `Se borra "${day.name ?? day.day_number}" con todos sus ejercicios.`,
                  confirmLabel: 'Eliminar',
                  danger: true,
                  onConfirm: onDelete,
                })
              }
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xs text-dim2 transition-colors hover:bg-red-500/10 hover:text-red-400"
              title="Eliminar día"
            >
              ✕
            </button>
          </div>
          <span className="text-xs text-dim2">
            {exCount} {exCount === 1 ? 'ejercicio' : 'ejercicios'}
          </span>
        </div>

        {exCount > 0 && (
          <Link
            to={`/entrenar/${day.id}`}
            className="mt-3 flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-400"
          >
            Iniciar Entrenamiento
          </Link>
        )}
      </div>

      {dialog}

      <button
        onClick={() => onOpenOverlay(day)}
        className="fixed bottom-20 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-2xl font-bold text-neutral-950 shadow-lg shadow-emerald-500/20 transition-colors hover:bg-emerald-400 sm:bottom-8"
        title="Agregar ejercicio"
      >
        +
      </button>
    </section>
  )
}

interface ExerciseRowProps {
  item: RoutineExercise
  canPair: boolean
  onRemove: () => void
  onUpdate: (
    patch: Partial<Pick<RoutineExercise, 'sets' | 'reps' | 'rest_seconds' | 'superset_group'>>,
  ) => void
  onToggleSuperset: () => void
}

function ExerciseRow({ item, canPair, onRemove, onUpdate, onToggleSuperset }: ExerciseRowProps) {
  const { ask, dialog } = useConfirm()
  const [sets, setSets] = useState(item.sets)
  const [reps, setReps] = useState(item.reps ?? '')
  const [rest, setRest] = useState(item.rest_seconds)
  const [saved, setSaved] = useState(false)
  const [removing, setRemoving] = useState(false)

  const ex = item.exercise

  const save = async (
    patch: Partial<Pick<RoutineExercise, 'sets' | 'reps' | 'rest_seconds'>>,
  ) => {
    await onUpdate(patch)
    setSaved(true)
    setTimeout(() => setSaved(false), 1200)
  }

  return (
    <SwipeRow actionLabel="Quitar" onAction={onRemove} bgClass="bg-surface">
      <li className="flex items-center gap-3 px-4 py-3">
        {ex?.image_url && (
          <img
            src={ex.image_url}
            alt=""
            loading="lazy"
            className="h-10 w-10 shrink-0 rounded-lg object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <Link
            to={`/ejercicios/${ex?.id}`}
            className="block truncate text-sm font-medium hover:text-emerald-400"
          >
            {ex?.name ?? 'Ejercicio'}
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              value={sets}
              onChange={(e) => setSets(Number(e.target.value))}
              onBlur={() => sets !== item.sets && save({ sets })}
              className="min-h-11 w-14 rounded-md border border-edge bg-bg px-2 py-1 text-xs outline-none focus:border-emerald-500"
              title="Series"
            />
            <span className="text-xs text-dim2">×</span>
            <input
              type="text"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              onBlur={() => reps !== item.reps && save({ reps })}
              className="min-h-11 w-16 rounded-md border border-edge bg-bg px-2 py-1 text-xs outline-none focus:border-emerald-500"
              title="Repeticiones"
            />
            <span className="text-xs text-dim2">reps</span>
            <span className="text-dim4">|</span>
            <input
              type="number"
              min={0}
              step={15}
              value={rest}
              onChange={(e) => setRest(Number(e.target.value))}
              onBlur={() => rest !== item.rest_seconds && save({ rest_seconds: rest })}
              className="min-h-11 w-20 rounded-md border border-edge bg-bg px-2 py-1 text-xs outline-none focus:border-emerald-500"
              title="Descanso (segundos)"
            />
            <span className="text-xs text-dim2">seg</span>
            {saved && <span className="text-xs text-emerald-400">✓</span>}
          </div>
        </div>
        <button
          onClick={onToggleSuperset}
          disabled={item.superset_group == null && !canPair}
          className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-sm transition-colors disabled:opacity-30 ${
            item.superset_group != null
              ? 'bg-emerald-500/15 text-emerald-400'
              : 'text-dim2 hover:bg-surface2 hover:text-soft'
          }`}
          title={
            item.superset_group != null
              ? 'Quitar superset'
              : 'Armar superset con el siguiente'
          }
        >
          ↔
        </button>
        <button
          onClick={() =>
            ask({
              title: 'Quitar ejercicio',
              message: `¿Quitar "${ex?.name}" del día?`,
              confirmLabel: 'Quitar',
              danger: true,
              onConfirm: async () => {
                setRemoving(true)
                await onRemove()
                setRemoving(false)
              },
            })
          }
          disabled={removing}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-sm text-dim2 transition-colors hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"
          title="Quitar ejercicio"
        >
          ✕
        </button>
        {dialog}
      </li>
    </SwipeRow>
  )
}
