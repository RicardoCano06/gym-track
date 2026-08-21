import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import DayCard from '@/components/DayCard'
import AddExerciseOverlay from '@/components/AddExerciseOverlay'
import { useToast } from '@/lib/toast-context'
import { dequeue, enqueueDelayed } from '@/lib/sync'
import {
  addExerciseToDay,
  createDay,
  deleteDay,
  fetchRoutineDetail,
  updateDay,
  updateRoutine,
  updateRoutineExercise,
} from '@/lib/db'
import type { Exercise, Routine, RoutineDay, RoutineExercise } from '@/lib/types'
import { displayName } from '@/lib/i18n'
import { useLang } from '@/lib/lang-context'

export default function RoutineDetail() {
  const { id } = useParams()
  const { pushToast } = useToast()
  const { lang, t } = useLang()
  const [routine, setRoutine] = useState<Routine | null>(null)
  const [days, setDays] = useState<RoutineDay[]>([])
  const [loading, setLoading] = useState(true)
  const [newDayName, setNewDayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [overlayDay, setOverlayDay] = useState<RoutineDay | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [routineName, setRoutineName] = useState('')

  async function saveRoutineName() {
    setEditingName(false)
    const name = routineName.trim()
    if (!routine || !name || name === routine.name) return
    try {
      await updateRoutine(routine.id, name)
      await refresh()
      pushToast('success', t('routines.renamed'))
    } catch (err) {
      console.error(err)
      pushToast('error', t('routines.renameError'))
    }
  }

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
      pushToast('error', t('rdetail.addDayError'))
    } finally {
      setSaving(false)
    }
  }

  async function handleUpdateDay(
    day: RoutineDay,
    patch: Partial<Pick<RoutineDay, 'name'>>,
  ) {
    try {
      await updateDay(day.id, patch)
      await refresh()
    } catch (err) {
      console.error(err)
      pushToast('error', t('rdetail.renameError'))
      throw err
    }
  }

  async function handleDeleteDay(day: RoutineDay) {
    try {
      await deleteDay(day.id)
      await refresh()
      pushToast('success', t('rdetail.dayDeleted'))
    } catch (err) {
      console.error(err)
      pushToast('error', t('rdetail.deleteError'))
      throw err
    }
  }

  function handleRemoveExercise(re: RoutineExercise) {
    setDays((prev) =>
      prev.map((d) =>
        d.id === re.day_id
          ? { ...d, exercises: (d.exercises ?? []).filter((x) => x.id !== re.id) }
          : d,
      ),
    )
    enqueueDelayed('routine_exercise_remove', { id: re.id }, 4000)
    pushToast(
      'info',
      t('rdetail.removed', {
        name: re.exercise ? displayName(re.exercise, lang) : t('day.exercise'),
      }),
      {
        label: t('rdetail.undo'),
        onClick: () => {
          dequeue((op) => op.kind === 'routine_exercise_remove' && op.payload.id === re.id)
          setDays((prev) =>
            prev.map((d) => {
              if (d.id !== re.day_id) return d
              if ((d.exercises ?? []).some((x) => x.id === re.id)) return d
              const ex = d.exercises ?? []
              const pos = re.position ?? ex.length + 1
              const at = ex.findIndex((x) => (x.position ?? 0) > pos)
              const next = [...ex]
              if (at < 0) next.push(re)
              else next.splice(at, 0, re)
              return { ...d, exercises: next }
            }),
          )
          pushToast('success', t('rdetail.restored'))
        },
      },
    )
  }

  async function handleAddExercise(day: RoutineDay, exercise: Exercise) {
    const position = (day.exercises?.length ?? 0) + 1
    try {
      await addExerciseToDay(day.id, exercise.id, position)
      await refresh()
    } catch (err) {
      console.error(err)
      pushToast('error', t('rdetail.addError'))
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
      pushToast('error', t('rdetail.supersetError'))
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="shimmer h-4 w-24 rounded bg-surface2" />
        <div className="shimmer h-8 w-1/2 rounded bg-surface2" />
        <div className="shimmer h-40 rounded-2xl bg-surface2" />
      </div>
    )
  }

  if (!routine) {
    return (
      <div className="mt-16 text-center">
        <p className="mt-4 font-medium">{t('rdetail.notFound')}</p>
        <Link
          to="/rutinas"
          className="mt-4 inline-block text-sm text-emerald-400 hover:underline"
        >
          {t('rdetail.back')}
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
        {t('rdetail.back')}
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">
        {editingName ? (
          <input
            autoFocus
            value={routineName}
            onChange={(e) => setRoutineName(e.target.value)}
            onBlur={saveRoutineName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveRoutineName()
              if (e.key === 'Escape') setEditingName(false)
            }}
            className="w-full max-w-sm rounded-lg border border-emerald-500/50 bg-bg px-3 py-2 text-2xl font-bold outline-none"
          />
        ) : (
          <span className="group inline-flex items-center gap-2">
            {routine.name}
            <button
              onClick={() => {
                setRoutineName(routine.name)
                setEditingName(true)
              }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-sm text-dim2 opacity-0 transition-opacity hover:bg-surface2 hover:text-soft group-hover:opacity-100"
              title={t('routines.rename')}
            >
              ✎
            </button>
          </span>
        )}
      </h1>
      <p className="mt-1 text-sm text-dim">
        {t('rdetail.days', {
          n: days.length,
          noun: days.length === 1 ? t('rdetail.dayOne') : t('rdetail.daysMany'),
        })}
      </p>

      <form onSubmit={handleAddDay} className="mt-6 space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={newDayName}
            onChange={(e) => setNewDayName(e.target.value)}
            placeholder={t('rdetail.dayNamePlaceholder')}
            className="flex-1 rounded-xl border border-edge bg-surface px-4 py-2.5 text-sm outline-none transition-all duration-200 placeholder:text-dim2 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
          <button
            type="submit"
            disabled={saving || !newDayName.trim()}
            className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 shadow-[0_4px_20px_rgba(16,185,129,0.35)] transition-all duration-200 hover:bg-emerald-400 active:scale-[0.98] disabled:opacity-50"
          >
            {t('rdetail.addDay')}
          </button>
        </div>
      </form>

      <div className="mt-6 space-y-6">
        {days.length === 0 && (
          <p className="mt-10 text-center text-sm text-dim2">
            {t('rdetail.firstDay')}
          </p>
        )}
        {days.map((day) => (
          <DayCard
            key={day.id}
            day={day}
            onUpdateDay={(patch) => handleUpdateDay(day, patch)}
            onDelete={() => handleDeleteDay(day)}
            onRemoveExercise={handleRemoveExercise}
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
