import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useParams } from 'react-router-dom'
import BottomSheet from '@/components/BottomSheet'
import ErrorState from '@/components/ErrorState'
import RestTimer from '@/components/RestTimer'
import { RestTimerProvider } from '@/components/TimerContext'
import { useWakeLock } from '@/hooks/useWakeLock'
import { useConfirm } from '@/lib/use-confirm'
import { useAuth } from '@/lib/auth-context'
import { useToast } from '@/lib/toast-context'
import {
  deleteSession,
  deleteSessionSet,
  fetchDayDetail,
  fetchSessionSets,
  findActiveSession,
  finishSession,
  startSession,
  upsertSessionSet,
} from '@/lib/db'
import { enqueue, genId } from '@/lib/sync'
import type { RoutineDay, RoutineExercise, Session, SessionSet } from '@/lib/types'
import { displayName } from '@/lib/i18n'
import { useLang } from '@/lib/lang-context'

const RPE_OPTIONS = ['', '5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10']
const FEELINGS = [
  { value: 2, label: '😩', textKey: 'train.feelVeryHard' },
  { value: 5, label: '😐', textKey: 'train.feelOkay' },
  { value: 7, label: '🙂', textKey: 'train.feelGood' },
  { value: 9, label: '😁', textKey: 'train.feelGreat' },
]

export default function Train() {
  const { dayId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { pushToast } = useToast()
  const { ask, dialog } = useConfirm()
  const { t } = useLang()

  const [day, setDay] = useState<RoutineDay | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [setsByEx, setSetsByEx] = useState<Record<string, SessionSet[]>>({})
  const [loading, setLoading] = useState(true)
  const [savedMap, setSavedMap] = useState<Record<string, boolean>>({})
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({})
  const [loadError, setLoadError] = useState<string | null>(null)
  const pending = useRef<Map<string, { row: SessionSet; timer?: number }>>(new Map())
  const [showFinish, setShowFinish] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [elapsedMinutes, setElapsedMinutes] = useState(0)
  const [active, setActive] = useState<{ exerciseId: string; index: number } | null>(null)
  const [noteTarget, setNoteTarget] = useState<{ exerciseId: string; index: number } | null>(null)
  const [noteText, setNoteText] = useState('')
  const activeInitRef = useRef(false)

  useWakeLock(session !== null)

  const load = useCallback(() => {
    if (!user || !dayId) return
    let cancelled = false
    setLoadError(null)
    setLoading(true)
    ;(async () => {
      try {
        const dayRes = await fetchDayDetail(dayId)
        let sess = await findActiveSession(user.id, dayId)
        if (!sess) sess = await startSession(user.id, dayId)
        if (cancelled) return
        setDay(dayRes)
        setSession(sess)

        const existing = await fetchSessionSets(sess.id)
        if (cancelled) return

        const map: Record<string, SessionSet[]> = {}
        for (const re of dayRes.exercises ?? []) {
          let rows = existing.filter((s) => s.exercise_id === re.exercise_id)
          if (rows.length === 0) {
            rows = Array.from({ length: re.sets }, (_, i) => ({
              id: genId(),
              session_id: sess.id,
              exercise_id: re.exercise_id,
              set_number: i + 1,
              weight_kg: null,
              reps: null,
              rpe: null,
              completed: false,
              notes: null,
            }))
          }
          map[re.exercise_id] = rows
        }
        if (cancelled) return
        setSetsByEx(map)
      } catch (err) {
        console.error(err)
        setLoadError(t('train.loadError'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, dayId, t])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!session) return
    // eslint-disable-next-line react/purity
    const start = new Date(session.started_at).getTime()
    const update = () => {
      // eslint-disable-next-line react/purity
      setElapsedMinutes(Math.max(0, Math.floor((Date.now() - start) / 60000)))
    }
    update()
    const t = setInterval(update, 30000)
    return () => clearInterval(t)
  }, [session])

  function findFirstPending(updated: Record<string, SessionSet[]> = setsByEx): {
    exerciseId: string
    index: number
  } | null {
    for (const re of day?.exercises ?? []) {
      const rows = updated[re.exercise_id] ?? []
      const idx = rows.findIndex((s) => !s.completed)
      if (idx >= 0) return { exerciseId: re.exercise_id, index: idx }
    }
    return null
  }

  function persistActive(a: { exerciseId: string; index: number } | null) {
    if (!session) return
    try {
      localStorage.setItem(`gymtrack-active-set-${session.id}`, JSON.stringify(a))
    } catch {
      // almacenamiento no disponible: la fila activa se re-deriva al cargar
    }
  }

  useEffect(() => {
    if (!session || activeInitRef.current || Object.keys(setsByEx).length === 0) return
    activeInitRef.current = true
    let saved: { exerciseId: string; index: number } | null = null
    try {
      saved = JSON.parse(localStorage.getItem(`gymtrack-active-set-${session.id}`) ?? 'null')
    } catch {
      saved = null
    }
    const valid =
      saved &&
      setsByEx[saved.exerciseId]?.[saved.index] &&
      !setsByEx[saved.exerciseId][saved.index].completed
    setActive(valid ? saved : findFirstPending())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, setsByEx])

  function openNote(exerciseId: string, index: number) {
    setNoteText(setsByEx[exerciseId][index]?.notes ?? '')
    setNoteTarget({ exerciseId, index })
  }

  function saveNote() {
    if (!noteTarget) return
    void updateSet(noteTarget.exerciseId, noteTarget.index, {
      notes: noteText.trim() || null,
    })
    setNoteTarget(null)
  }

  function updateSet(
    exerciseId: string,
    index: number,
    patch: Partial<SessionSet>,
  ) {
    const rows = setsByEx[exerciseId]
    const row = { ...rows[index], ...patch }
    const rowsUpdated = rows.map((s, i) => (i === index ? row : s))
    setSetsByEx((prev) => ({ ...prev, [exerciseId]: rowsUpdated }))
    if (patch.completed === true) {
      navigator.vibrate?.(30)
      const nextIndex = rowsUpdated.findIndex((s, i) => i !== index && !s.completed)
      const next =
        nextIndex >= 0
          ? { exerciseId, index: nextIndex }
          : findFirstPending({ ...setsByEx, [exerciseId]: rowsUpdated })
      setActive(next)
      persistActive(next)
    }
    // Solo estado local en cada tecla; la red se difiere con debounce.
    schedulePersist(exerciseId, index, row)
  }

  function schedulePersist(exerciseId: string, index: number, row: SessionSet) {
    const key = `${exerciseId}-${index}`
    setSavingMap((prev) => ({ ...prev, [key]: true }))
    const prevEntry = pending.current.get(key)
    if (prevEntry?.timer) clearTimeout(prevEntry.timer)
    const timer = window.setTimeout(() => {
      void flush(key)
    }, 800)
    pending.current.set(key, { row, timer })
  }

  async function flush(key: string) {
    const entry = pending.current.get(key)
    if (!entry?.row) return
    pending.current.delete(key)
    try {
      await upsertSessionSet(entry.row)
      setSavedMap((prev) => ({ ...prev, [key]: true }))
      setSavingMap((p) => ({ ...p, [key]: false }))
      window.setTimeout(() => setSavedMap((p) => ({ ...p, [key]: false })), 1200)
    } catch (err) {
      console.error(err)
      enqueue('session_set_upsert', { ...entry.row })
      setSavingMap((p) => ({ ...p, [key]: false }))
    }
  }

  function commitSet(exerciseId: string, index: number) {
    const key = `${exerciseId}-${index}`
    const entry = pending.current.get(key)
    if (entry?.timer) {
      clearTimeout(entry.timer)
      void flush(key)
    }
  }

  function flushAll() {
    pending.current.forEach((entry) => {
      if (entry.timer) clearTimeout(entry.timer)
      if (entry.row) enqueue('session_set_upsert', { ...entry.row })
    })
    pending.current.clear()
    setSavingMap({})
  }

  function cancelPending() {
    pending.current.forEach((entry) => {
      if (entry.timer) clearTimeout(entry.timer)
    })
    pending.current.clear()
    setSavingMap({})
  }

  useEffect(() => {
    const flushAllOnHide = () => {
      if (document.visibilityState === 'hidden') flushAll()
    }
    document.addEventListener('visibilitychange', flushAllOnHide)
    window.addEventListener('pagehide', flushAllOnHide)
    return () => {
      document.removeEventListener('visibilitychange', flushAllOnHide)
      window.removeEventListener('pagehide', flushAllOnHide)
      flushAll()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function deleteSet(exerciseId: string, index: number) {
    const row = setsByEx[exerciseId][index]
    const rowsUpdated = setsByEx[exerciseId].filter((_, i) => i !== index)
    setSetsByEx((prev) => ({ ...prev, [exerciseId]: rowsUpdated }))
    if (active?.exerciseId === exerciseId && active.index === index) {
      const next = findFirstPending({ ...setsByEx, [exerciseId]: rowsUpdated })
      setActive(next)
      persistActive(next)
    }
    try {
      await deleteSessionSet(row.id)
      pushToast('success', t('train.setDeleted'))
    } catch (err) {
      console.error(err)
      pushToast('error', t('train.setDeleteError'))
      throw err
    }
  }

  async function handleFinish(feeling: number | null) {
    if (!session || finishing) return
    setFinishing(true)
    try {
      flushAll()
      await finishSession(
        session.id,
        Math.max(1, Math.round(elapsedMinutes)),
        feeling,
      )
      pushToast('success', t('train.saved'))
      navigate('/historial')
    } catch (err) {
      console.error(err)
      setFinishing(false)
    }
  }

  async function handleDiscard() {
    if (!session) return
    cancelPending()
    try {
      await deleteSession(session.id)
      pushToast('info', t('train.discarded'))
      navigate('/rutinas')
    } catch (err) {
      console.error(err)
      pushToast('error', t('train.discardError'))
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="shimmer h-8 w-1/2 rounded-lg bg-surface2" />
        <div className="shimmer h-6 w-40 rounded-lg bg-surface2" />
        <div className="shimmer h-48 rounded-2xl bg-surface2" />
        <div className="shimmer h-48 rounded-2xl bg-surface2" />
      </div>
    )
  }

  if (loadError) {
    return <ErrorState title={t('train.loadErrorTitle')} message={loadError} onRetry={load} />
  }

  if (!day || !session) {
    return (
      <div className="mt-16 text-center">
        <div className="text-5xl">🤔</div>
        <p className="mt-4 font-medium">{t('train.notFound')}</p>
        <Link
          to="/rutinas"
          className="mt-4 inline-block text-sm text-emerald-400 hover:underline"
        >
          {t('train.backRoutines')}
        </Link>
      </div>
    )
  }

  const allDone =
    Object.values(setsByEx).flat().length > 0 &&
    Object.values(setsByEx).flat().every((s) => s.completed)

  const supersets = new Map<number, RoutineExercise[]>()
  for (const re of day.exercises ?? []) {
    if (re.superset_group != null) {
      const group = supersets.get(re.superset_group) ?? []
      group.push(re)
      supersets.set(re.superset_group, group)
    }
  }

  return (
    <RestTimerProvider>
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-dim2">
            {t('train.activeSession')}
          </p>
          <h1 className="text-2xl font-bold tracking-tight">
            {day.name ?? t('day.number', { n: day.day_number })}
          </h1>
          {day.weekday && (
            <span className="mt-1 inline-block rounded-full border border-edge bg-surface2 px-2.5 py-0.5 text-xs text-dim">
              {day.weekday.charAt(0).toUpperCase() + day.weekday.slice(1)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              ask({
                title: t('train.discardTitle'),
                message: t('train.discardMessage'),
                confirmLabel: t('train.discard'),
                danger: true,
                onConfirm: handleDiscard,
              })
            }
            className="min-h-11 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 transition-all duration-200 hover:bg-red-500/10 active:scale-95"
          >
            {t('train.discard')}
          </button>
          <span className="rounded-full border border-edge bg-surface px-3 py-1.5 font-mono text-sm font-bold tabular-nums text-soft">
            ⏱ {Math.floor(elapsedMinutes / 60)}h {elapsedMinutes % 60}m
          </span>
        </div>
      </div>

      <div className="mt-4">
        {!active && <RestTimer />}
      </div>

      <div className="mt-6 space-y-5">
        {(day.exercises ?? []).map((re) => {
          if (re.superset_group != null) {
            const group = supersets.get(re.superset_group)
            if (!group || group[0].exercise_id !== re.exercise_id) return null
            return (
              <div
                key={`ss-${re.superset_group}`}
                className="glass-card card-hairline overflow-hidden rounded-2xl"
              >
                <div className="flex items-center justify-between border-b border-edge bg-surface2/60 px-4 py-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-dim2">
                    {t('train.superset')}
                  </span>
                  <span className="text-xs text-dim2">{t('train.supersetHint')}</span>
                </div>
                <div className="grid gap-px bg-edge/60 sm:grid-cols-2">
                  {group.map((g) => (
                    <ExerciseBlock
                      key={g.exercise_id}
                      re={g}
                      rows={setsByEx[g.exercise_id] ?? []}
                      savedMap={savedMap}
                      savingMap={savingMap}
                      onUpdateSet={(i, patch) => updateSet(g.exercise_id, i, patch)}
                      onDeleteSet={(i) => deleteSet(g.exercise_id, i)}
                      onNoteSet={(i) => openNote(g.exercise_id, i)}
                      onCommit={(i) => commitSet(g.exercise_id, i)}
                      activeIndex={
                        active?.exerciseId === g.exercise_id ? active.index : undefined
                      }
                      timer={
                        active?.exerciseId === g.exercise_id ? <RestTimer /> : undefined
                      }
                      bare
                    />
                  ))}
                </div>
              </div>
            )
          }
          return (
            <ExerciseBlock
              key={re.exercise_id}
              re={re}
              rows={setsByEx[re.exercise_id] ?? []}
              savedMap={savedMap}
              savingMap={savingMap}
              onUpdateSet={(i, patch) => updateSet(re.exercise_id, i, patch)}
              onDeleteSet={(i) => deleteSet(re.exercise_id, i)}
              onNoteSet={(i) => openNote(re.exercise_id, i)}
              onCommit={(i) => commitSet(re.exercise_id, i)}
              activeIndex={
                active?.exerciseId === re.exercise_id ? active.index : undefined
              }
              timer={active?.exerciseId === re.exercise_id ? <RestTimer /> : undefined}
            />
          )
        })}
      </div>

      {createPortal(
      <div className="fixed inset-x-4 bottom-24 z-30 mx-auto max-w-5xl md:bottom-6">
        {!showFinish ? (
          <div className="flex justify-end">
            <button
              onClick={() => setShowFinish(true)}
              className="rounded-2xl bg-emerald-500 px-8 py-3.5 font-semibold text-neutral-950 shadow-[0_4px_24px_rgba(16,185,129,0.35)] transition-all duration-200 hover:bg-emerald-400 hover:shadow-[0_4px_36px_rgba(16,185,129,0.5)] active:scale-[0.98]"
            >
              {allDone ? t('train.finishAll') : t('train.finish')}
            </button>
          </div>
        ) : (
          <div className="glass-strong card-hairline rounded-2xl p-4 text-center">
            <p className="font-semibold">{t('train.howFeel')}</p>
            <div className="mt-3 flex justify-center gap-2">
              {FEELINGS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => handleFinish(f.value)}
                  className="flex flex-col items-center gap-1 rounded-xl border border-edge bg-bg px-4 py-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-edge2 active:scale-95"
                  title={t(f.textKey)}
                >
                  <span className="text-2xl">{f.label}</span>
                  <span className="text-xs text-dim2">{t(f.textKey)}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => handleFinish(null)}
              disabled={finishing}
              className="mt-3 text-sm text-dim2 hover:text-soft disabled:opacity-50"
            >
              {finishing ? t('train.saving') : t('train.finishNoFeeling')}
            </button>
          </div>
        )}
      </div>,
      document.body,
    )}

      {noteTarget && (
        <BottomSheet title={t('train.noteTitle')} onClose={() => setNoteTarget(null)}>
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            rows={3}
            placeholder={t('train.notePlaceholder')}
            className="w-full rounded-lg border border-edge bg-bg px-3 py-2 text-sm outline-none transition-colors placeholder:text-dim2 focus:border-emerald-500"
            autoFocus
          />
          <button
            onClick={saveNote}
            className="mt-4 min-h-12 w-full rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-400"
          >
            {t('train.saveNote')}
          </button>
        </BottomSheet>
      )}
      {dialog}
    </div>
    </RestTimerProvider>
  )
}

interface SetRowProps {
  set: SessionSet
  saved: boolean
  saving: boolean
  active: boolean
  onUpdate: (patch: Partial<SessionSet>) => void
  onCommit: () => void
  onDelete: () => void
  onNote: () => void
}

interface ExerciseBlockProps {
  re: RoutineExercise
  rows: SessionSet[]
  savedMap: Record<string, boolean>
  savingMap: Record<string, boolean>
  onUpdateSet: (index: number, patch: Partial<SessionSet>) => void
  onDeleteSet: (index: number) => void
  onNoteSet: (index: number) => void
  onCommit: (index: number) => void
  activeIndex?: number
  timer?: ReactNode
  bare?: boolean
}

function ExerciseBlock({
  re,
  rows,
  savedMap,
  savingMap,
  onUpdateSet,
  onDeleteSet,
  onNoteSet,
  onCommit,
  activeIndex,
  timer,
  bare,
}: ExerciseBlockProps) {
  const exercise = re.exercise
  const doneCount = rows.filter((s) => s.completed).length
  const { lang, t } = useLang()
  return (
    <section
      className={`overflow-hidden transition-shadow duration-300 ${
        bare ? 'bg-bg' : 'glass-card card-hairline rounded-2xl'
      }`}
    >
      <div className="flex items-center gap-3 border-b border-edge px-4 py-3">
        {exercise?.image_url && (
          <img
            src={exercise.image_url}
            alt=""
            className="h-11 w-11 rounded-xl object-cover ring-1 ring-inset ring-edge"
          />
        )}
        <div className="min-w-0 flex-1">
          <Link
            to={`/ejercicios/${exercise?.id}`}
            className="block truncate font-semibold text-high transition-colors hover:text-emerald-400"
          >
                        {exercise ? displayName(exercise, lang) : t('day.exercise')}
          </Link>
          <p className="text-xs text-dim2">{t('train.plan', { sets: re.sets, reps: re.reps ?? '?' })}</p>
        </div>
        <span className="rounded-full bg-surface2/80 px-2.5 py-1 font-mono text-xs font-semibold tabular-nums text-dim">
          {doneCount}/{rows.length}
        </span>
      </div>

      <ul className="divide-y divide-edge/60">
        {rows.map((set, i) => (
          <SetRow
            key={`${set.exercise_id}-${set.set_number}`}
            set={set}
            saved={!!savedMap[`${set.exercise_id}-${i}`]}
            saving={!!savingMap[`${set.exercise_id}-${i}`]}
            active={activeIndex === i}
            onUpdate={(patch) => onUpdateSet(i, patch)}
            onCommit={() => onCommit(i)}
            onDelete={() => onDeleteSet(i)}
            onNote={() => onNoteSet(i)}
          />
        ))}
      </ul>

      {timer && <div className="border-t border-edge px-3 py-3">{timer}</div>}

      {doneCount === rows.length && rows.length > 0 && (
        <div className="border-t border-edge px-4 py-2 text-center text-xs font-medium text-emerald-400">
          {t('train.done')}
        </div>
      )}
    </section>
  )
}

function SetRow({ set, saved, saving, active, onUpdate, onCommit, onDelete, onNote }: SetRowProps) {
  const { ask, dialog } = useConfirm()
  const { t } = useLang()
  const rowRef = useRef<HTMLLIElement>(null)
  const done = set.completed

  useEffect(() => {
    if (active) {
      rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
  }, [active])

  const stepWeight = (dir: number) => {
    const base = set.weight_kg ?? 0
    const next = Math.max(0, Math.round((base + 2.5 * dir) * 2) / 2)
    onUpdate({ weight_kg: next })
  }

  const stepReps = (dir: number) => {
    const base = set.reps ?? 0
    onUpdate({ reps: Math.max(0, base + dir) })
  }

  const btn =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-edge2 bg-surface2 text-sm font-semibold text-soft transition-all duration-150 active:scale-90 hover:border-edge2 hover:text-strong'

  const field =
    'h-14 w-20 rounded-xl border border-edge bg-bg px-1 text-center font-mono text-lg font-semibold tabular-nums outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'

  return (
    <li
      ref={rowRef}
      className={`flex items-start gap-2 px-2 py-2 transition-all duration-200 ${
        active ? 'bg-surface2/40 ring-2 ring-inset ring-edge2' : ''
      } ${saving ? 'ring-1 ring-inset ring-edge2' : ''} ${
        done ? 'bg-surface2/60' : ''
      }`}
    >
      <button
        onClick={() => {
          onUpdate({ completed: !done })
          if (!done) navigator.vibrate?.(30)
        }}
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border-2 text-sm font-bold transition-all duration-200 active:scale-95 ${
          done
            ? 'border-emerald-500 bg-gradient-to-b from-emerald-500 to-emerald-600 text-neutral-950 shadow-[0_0_20px_rgba(16,185,129,0.4)]'
            : 'border-edge2 bg-bg text-dim2 hover:border-emerald-500/60 hover:bg-emerald-500/5 hover:text-emerald-400'
        }`}
        title={done ? t('train.uncompleteSet') : t('train.completeSet')}
      >
        {done ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6 animate-pop"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
          <span className="font-mono tabular-nums">{set.set_number}</span>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex items-center gap-1">
            <span className="w-8 text-xs text-dim2">{t('train.weight')}</span>
            <button onClick={() => stepWeight(-1)} className={btn} title={t('train.lowerWeight')}>
              −
            </button>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              value={set.weight_kg ?? ''}
              onChange={(e) =>
                onUpdate({ weight_kg: e.target.value === '' ? null : Number(e.target.value) })
              }
              onBlur={onCommit}
              placeholder={t('train.weight')}
              className={`${field} ${done ? 'text-neutral-400' : ''}`}
            />
            <button onClick={() => stepWeight(1)} className={btn} title={t('train.raiseWeight')}>
              +
            </button>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-8 text-xs text-dim2">{t('train.reps')}</span>
            <button onClick={() => stepReps(-1)} className={btn} title={t('train.lowerReps')}>
              −
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={set.reps ?? ''}
              onChange={(e) =>
                onUpdate({ reps: e.target.value === '' ? null : Number(e.target.value) })
              }
              onBlur={onCommit}
              placeholder={t('train.reps')}
              className={`${field} ${done ? 'text-neutral-400' : ''}`}
            />
            <button onClick={() => stepReps(1)} className={btn} title={t('train.raiseReps')}>
              +
            </button>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <select
            value={set.rpe === null ? '' : String(set.rpe)}
            onChange={(e) =>
              onUpdate({ rpe: e.target.value === '' ? null : Number(e.target.value) })
            }
            onBlur={onCommit}
            className={`min-h-11 min-w-0 flex-1 rounded-xl border border-edge bg-bg px-2 text-xs outline-none transition-all duration-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 ${
              done ? 'text-dim2' : ''
            }`}
            title={t('train.rpe')}
          >
            {RPE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o === '' ? 'RPE' : `RPE ${o}`}
              </option>
            ))}
          </select>
          {saved && (
            <span className="animate-pop text-xs text-dim">✓</span>
          )}
          <button
            onClick={onNote}
            className={`flex h-11 w-10 shrink-0 items-center justify-center rounded-lg text-lg transition-all duration-200 active:scale-90 ${
              set.notes ? 'text-soft' : 'text-dim2 hover:bg-surface2 hover:text-soft'
            }`}
            title={set.notes ? t('train.editNote') : t('train.addNote')}
          >
            ⋯
          </button>
          <button
            onClick={() =>
              ask({
                title: t('train.deleteSetTitle'),
                message: t('train.deleteSetMessage', {
                  n: set.set_number,
                }),
                confirmLabel: t('train.delete'),
                danger: true,
                onConfirm: onDelete,
              })
            }
            className="flex h-11 w-10 shrink-0 items-center justify-center rounded-lg text-dim2 transition-all duration-200 hover:bg-red-500/10 hover:text-red-400 active:scale-90"
            title={t('train.deleteSetTitle')}
          >
            ✕
          </button>
        </div>
      </div>
      {dialog}
    </li>
  )
}