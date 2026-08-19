import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import AddExerciseInline from '@/components/AddExerciseInline'
import SwipeRow from '@/components/SwipeRow'
import { useConfirm } from '@/lib/use-confirm'
import { useToast } from '@/lib/toast-context'
import { WEEKDAYS } from '@/lib/constants'
import {
  addExerciseToDay,
  createDay,
  deleteDay,
  fetchExercisesByGroup,
  fetchMuscleGroups,
  fetchRoutineDetail,
  removeRoutineExercise,
  updateDay,
  updateRoutineExercise,
} from '@/lib/db'
import type { Exercise, Routine, RoutineDay, RoutineExercise } from '@/lib/types'

export default function RoutineDetail() {
  const { id } = useParams()
  const { ask, dialog } = useConfirm()
  const { pushToast } = useToast()
  const [routine, setRoutine] = useState<Routine | null>(null)
  const [days, setDays] = useState<RoutineDay[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [newDayName, setNewDayName] = useState('')
  const [newDayWeekday, setNewDayWeekday] = useState('')
  const [newDayGoal, setNewDayGoal] = useState('')
  const [saving, setSaving] = useState(false)

  const refresh = async () => {
    if (!id) return
    const res = await fetchRoutineDetail(id)
    setRoutine(res.routine)
    setDays(res.days)
  }

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([refresh(), fetchMuscleGroups().then(setGroups)])
      .catch(console.error)
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleAddDay(e: FormEvent) {
    e.preventDefault()
    if (!routine || !newDayName.trim() || saving) return
    setSaving(true)
    try {
      await createDay(
        routine.id,
        days.length + 1,
        newDayName.trim(),
        newDayWeekday || null,
        newDayGoal || null,
      )
      await refresh()
      setNewDayName('')
      setNewDayWeekday('')
      setNewDayGoal('')
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateDay(
    day: RoutineDay,
    patch: Partial<Pick<RoutineDay, 'name' | 'weekday' | 'goal'>>,
  ) {
    await updateDay(day.id, patch)
    await refresh()
  }

  async function handleDeleteDay(day: RoutineDay) {
    ask({
      title: 'Eliminar día',
      message: `Se borra "${day.name ?? day.day_number}" con todos sus ejercicios.`,
      confirmLabel: 'Eliminar',
      danger: true,
      onConfirm: async () => {
        await deleteDay(day.id)
        await refresh()
      },
    })
  }

  async function handleAddExercise(day: RoutineDay, exercise: Exercise) {
    const position = (day.exercises?.length ?? 0) + 1
    try {
      await addExerciseToDay(day.id, exercise.id, position)
      await refresh()
    } catch (err) {
      console.error(err)
      pushToast('error', 'No se pudo agregar el ejercicio. Revisá tu conexión e intentá de nuevo.')
    }
  }

  async function handleToggleSuperset(
    day: RoutineDay,
    re: RoutineExercise,
    index: number,
  ) {
    try {
      if (re.superset_group != null) {
        await updateRoutineExercise(re.id, { superset_group: null })
      } else {
        const next = (day.exercises ?? [])[index + 1]
        if (!next) return
        const maxGroup = Math.max(
          0,
          ...(day.exercises ?? []).map((e) => e.superset_group ?? 0),
        )
        const group = maxGroup + 1
        await updateRoutineExercise(re.id, { superset_group: group })
        await updateRoutineExercise(next.id, { superset_group: group })
      }
      await refresh()
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-4 w-24 rounded bg-surface2" />
        <div className="h-8 w-1/2 rounded bg-surface2" />
        <div className="h-40 rounded-xl bg-surface2" />
      </div>
    )
  }

  if (!routine) {
    return (
      <div className="mt-16 text-center">
        <div className="text-5xl">🤔</div>
        <p className="mt-4 font-medium">No se encontró la rutina</p>
        <Link
          to="/rutinas"
          className="mt-4 inline-block text-sm text-emerald-400 hover:underline"
        >
          ← Volver a rutinas
        </Link>
      </div>
    )
  }

  return (
    <div>
      <Link
        to="/rutinas"
        className="mb-4 inline-flex items-center gap-1 text-sm text-dim transition-colors hover:text-emerald-400"
      >
        ← Volver a rutinas
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">{routine.name}</h1>
      <p className="mt-1 text-sm text-dim">
        {days.length} {days.length === 1 ? 'día' : 'días'} de entrenamiento
      </p>

      <form onSubmit={handleAddDay} className="mt-6 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={newDayName}
            onChange={(e) => setNewDayName(e.target.value)}
            placeholder="Nombre del día (ej: Push, Pull, Pierna, Full Body...)"
            className="flex-1 rounded-lg border border-edge bg-surface px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-dim2 focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={saving || !newDayName.trim()}
            className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
          >
            Agregar día
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            value={newDayWeekday}
            onChange={(e) => setNewDayWeekday(e.target.value)}
            className="rounded-lg border border-edge bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-500"
          >
            <option value="">Sin día fijo</option>
            {WEEKDAYS.map((w) => (
              <option key={w} value={w}>
                {w.charAt(0).toUpperCase() + w.slice(1)}
              </option>
            ))}
          </select>
          <select
            value={newDayGoal}
            onChange={(e) => setNewDayGoal(e.target.value)}
            className="rounded-lg border border-edge bg-surface px-3 py-2 text-sm outline-none transition-colors focus:border-emerald-500"
          >
            <option value="">Sin grupo muscular</option>
            {groups.map((g) => (
              <option key={g} value={g}>
                {g.charAt(0).toUpperCase() + g.slice(1)}
              </option>
            ))}
          </select>
          {(newDayWeekday || newDayGoal) && (
            <p className="self-center text-xs text-dim2">
              {newDayWeekday && `Entrena los ${newDayWeekday}s`}
              {newDayWeekday && newDayGoal && ' · '}
              {newDayGoal && `recomendaciones para ${newDayGoal}`}
            </p>
          )}
        </div>
      </form>

      <div className="mt-6 space-y-6">
        {days.length === 0 && (
          <p className="mt-10 text-center text-sm text-dim2">
            Agregá tu primer día de entrenamiento arriba
          </p>
        )}
        {days.map((day) => (
          <DayCard
            key={day.id}
            day={day}
            groups={groups}
            onUpdateDay={(patch) => handleUpdateDay(day, patch)}
            onDelete={() => handleDeleteDay(day)}
            onAddExercise={(d, ex) => handleAddExercise(d, ex)}
            onRemoveExercise={async (re) => {
              await removeRoutineExercise(re.id)
              await refresh()
            }}
            onUpdateExercise={async (re, patch) => {
              await updateRoutineExercise(re.id, patch)
            }}
            onToggleSuperset={(re, index) => handleToggleSuperset(day, re, index)}
          />
        ))}
      </div>

      {dialog}
    </div>
  )
}

interface DayCardProps {
  day: RoutineDay
  groups: string[]
  onUpdateDay: (patch: Partial<Pick<RoutineDay, 'name' | 'weekday' | 'goal'>>) => void
  onDelete: () => void
  onAddExercise: (day: RoutineDay, exercise: Exercise) => void
  onRemoveExercise: (re: RoutineExercise) => void
  onUpdateExercise: (
    re: RoutineExercise,
    patch: Partial<
      Pick<RoutineExercise, 'sets' | 'reps' | 'rest_seconds' | 'superset_group'>
    >,
  ) => void
  onToggleSuperset: (re: RoutineExercise, index: number) => void
}

function DayCard({
  day,
  groups,
  onUpdateDay,
  onDelete,
  onAddExercise,
  onRemoveExercise,
  onUpdateExercise,
  onToggleSuperset,
}: DayCardProps) {
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

  return (
    <section className="overflow-hidden rounded-xl border border-edge bg-surface">
      <div className="flex items-center justify-between gap-2 border-b border-edge px-4 py-3">
        {editingName ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === 'Enter' && saveName()}
            className="rounded-lg border border-emerald-500/50 bg-bg px-2 py-1 text-sm font-semibold outline-none"
          />
        ) : (
          <button
            onClick={() => {
              setName(day.name ?? '')
              setEditingName(true)
            }}
            className="flex items-center gap-2 text-left"
            title="Renombrar día"
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/15 text-xs font-bold text-emerald-400">
              {day.day_number}
            </span>
            <h3 className="font-semibold">{day.name ?? `Día ${day.day_number}`}</h3>
            {day.weekday && (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
                {day.weekday.charAt(0).toUpperCase() + day.weekday.slice(1)}
              </span>
            )}
            <span className="text-xs text-dim2">✎</span>
          </button>
        )}
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setWeekday(day.weekday ?? '')
              setGoal(day.goal ?? '')
              setEditingSettings(true)
            }}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xs text-dim2 transition-colors hover:bg-surface2 hover:text-high"
            title="Editar día de la semana y grupo muscular"
          >
            ⚙
          </button>
          <span className="text-xs text-dim2">
            {day.exercises?.length ?? 0}{' '}
            {(day.exercises?.length ?? 0) === 1 ? 'ejercicio' : 'ejercicios'}
          </span>
          <Link
            to={`/entrenar/${day.id}`}
            className="ml-2 flex min-h-11 items-center rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-neutral-950 transition-colors hover:bg-emerald-400"
          >
            Entrenar ▶
          </Link>
          <button
            onClick={onDelete}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-xs text-dim2 transition-colors hover:bg-red-500/10 hover:text-red-400"
            title="Eliminar día"
          >
            ✕
          </button>
        </div>
      </div>

      {editingSettings && (
        <div className="flex flex-wrap items-center gap-2 border-b border-edge bg-bg/50 px-4 py-3">
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
          <p className="text-xs text-dim2">Guardado al salir de la selección</p>
        </div>
      )}

      {day.exercises && day.exercises.length > 0 && (
        <ul className="divide-y divide-edge">
          {day.exercises.map((re, index) => (
            <ExerciseRow
              key={re.id}
              item={re}
              canPair={index < (day.exercises?.length ?? 0) - 1}
              onRemove={() => onRemoveExercise(re)}
              onUpdate={(patch) => onUpdateExercise(re, patch)}
              onToggleSuperset={() => onToggleSuperset(re, index)}
            />
          ))}
        </ul>
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

      <AddExerciseInline day={day} onAddExercise={onAddExercise} />
    </section>
  )
}

interface ExerciseRowProps {
  item: RoutineExercise
  canPair: boolean
  onRemove: () => void
  onUpdate: (
    patch: Partial<
      Pick<RoutineExercise, 'sets' | 'reps' | 'rest_seconds' | 'superset_group'>
    >,
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
        <span className="w-5 shrink-0 text-center text-xs font-bold text-dim2">
          {item.position}
        </span>
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
            title="Repeticiones (ej: 8-12, fallo)"
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
            title="Descanso en segundos"
          />
          <span className="text-xs text-dim2">seg descanso</span>
          {saved && <span className="text-xs text-emerald-400">✓ guardado</span>}
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
            : 'Armar superset con el ejercicio siguiente'
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