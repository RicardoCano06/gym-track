import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import DayCard from '@/components/DayCard'
import AddExerciseOverlay from '@/components/AddExerciseOverlay'
import { useToast } from '@/lib/toast-context'
import {
  addExerciseToDay,
  createDay,
  deleteDay,
  fetchRoutineDetail,
  removeRoutineExercise,
  updateDay,
  updateRoutineExercise,
} from '@/lib/db'
import type { Exercise, Routine, RoutineDay, RoutineExercise } from '@/lib/types'

export default function RoutineDetail() {
  const { id } = useParams()
  const { pushToast } = useToast()
  const [routine, setRoutine] = useState<Routine | null>(null)
  const [days, setDays] = useState<RoutineDay[]>([])
  const [loading, setLoading] = useState(true)
  const [newDayName, setNewDayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [overlayDay, setOverlayDay] = useState<RoutineDay | null>(null)

  const refresh = async () => {
    if (!id) return
    const res = await fetchRoutineDetail(id)
    setRoutine(res.routine)
    setDays(res.days)
  }

  useEffect(() => {
    if (!id) return
    setLoading(true)
    refresh()
      .catch(console.error)
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function handleAddDay(e: FormEvent) {
    e.preventDefault()
    if (!routine || !newDayName.trim() || saving) return
    setSaving(true)
    try {
      await createDay(routine.id, days.length + 1, newDayName.trim(), null, null)
      await refresh()
      setNewDayName('')
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateDay(
    day: RoutineDay,
    patch: Partial<Pick<RoutineDay, 'name'>>,
  ) {
    await updateDay(day.id, patch)
    await refresh()
  }

  async function handleDeleteDay(day: RoutineDay) {
    await deleteDay(day.id)
    await refresh()
  }

  async function handleAddExercise(day: RoutineDay, exercise: Exercise) {
    const position = (day.exercises?.length ?? 0) + 1
    try {
      await addExerciseToDay(day.id, exercise.id, position)
      await refresh()
    } catch (err) {
      console.error(err)
      pushToast('error', 'No se pudo agregar el ejercicio.')
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
            placeholder="Nombre del día (ej: Push, Pull, Pierna...)"
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
            onUpdateDay={(patch) => handleUpdateDay(day, patch)}
            onDelete={() => handleDeleteDay(day)}
            onRemoveExercise={async (re) => {
              await removeRoutineExercise(re.id)
              await refresh()
            }}
            onUpdateExercise={async (re, patch) => {
              await updateRoutineExercise(re.id, patch)
            }}
            onToggleSuperset={(re, index) => handleToggleSuperset(day, re, index)}
            onOpenOverlay={(d) => setOverlayDay(d)}
          />
        ))}
      </div>

      {overlayDay && (
        <AddExerciseOverlay
          day={overlayDay}
          onClose={() => setOverlayDay(null)}
          onAdd={(exercise) => {
            handleAddExercise(overlayDay, exercise)
          }}
        />
      )}
    </div>
  )
}
