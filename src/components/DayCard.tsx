import { useState } from 'react'
import { Link } from 'react-router-dom'
import SwipeRow from '@/components/SwipeRow'
import { useConfirm } from '@/lib/use-confirm'
import { useToast } from '@/lib/toast-context'
import { displayName } from '@/lib/i18n'
import { useLang } from '@/lib/lang-context'
import type { RoutineDay, RoutineExercise } from '@/lib/types'

interface DayCardProps {
  day: RoutineDay
  onUpdateDay: (patch: Partial<Pick<RoutineDay, 'name'>>) => void
  onDelete: () => void
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
  onUpdateDay,
  onDelete,
  onRemoveExercise,
  onUpdateExercise,
  onToggleSuperset,
  onOpenOverlay,
}: DayCardProps) {
  const { ask, dialog } = useConfirm()
  const { pushToast } = useToast()
  const { t } = useLang()
  const [editingName, setEditingName] = useState(false)
  const [name, setName] = useState(day.name ?? '')
  const [busy, setBusy] = useState(false)

  async function saveName() {
    setEditingName(false)
    if (busy) return
    setBusy(true)
    try {
      if (name.trim() && name !== day.name) await onUpdateDay({ name: name.trim() })
    } catch (err) {
      console.error(err)
      pushToast('error', t('day.renameError'))
    } finally {
      setBusy(false)
    }
  }

  const exCount = day.exercises?.length ?? 0

  return (
    <section className="glass-card card-hairline relative overflow-hidden rounded-2xl">
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
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
                title={t('day.rename')}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface2 text-xs font-bold text-soft">
                  {day.day_number}
                </span>
                <h3 className="text-lg font-bold tracking-tight">
                  {day.name ?? t('day.number', { n: day.day_number })}
                </h3>
                <span className="text-xs text-dim2">✎</span>
              </button>
            )}
          </div>
          <button
            onClick={() =>
              ask({
                title: t('day.deleteTitle'),
                message: t('day.deleteMessage', {
                  name: day.name ?? day.day_number,
                }),
                confirmLabel: t('day.delete'),
                danger: true,
                onConfirm: onDelete,
              })
            }
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-dim2 transition-colors hover:bg-red-500/10 hover:text-red-400"
            title={t('day.deleteTitle')}
            aria-label={t('day.deleteTitle')}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M3 6h18" />
              <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
              <path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>
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
          <p className="text-sm font-medium text-soft">{t('day.emptyTitle')}</p>
          <p className="text-xs text-dim2">{t('day.emptyHint')}</p>
          <button
            onClick={() => onOpenOverlay(day)}
            className="mt-1 flex min-h-11 w-full max-w-xs items-center justify-center gap-1.5 rounded-xl border border-dashed border-edge2 px-4 py-2 text-sm font-medium text-dim transition-colors hover:bg-surface2 hover:text-soft"
          >
            <span className="text-base leading-none">+</span> {t('day.addExercises')}
          </button>
        </div>
      )}

      {exCount > 0 && (
        <div className="px-4 pb-3 pt-2">
          <button
            onClick={() => onOpenOverlay(day)}
            className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-edge2 text-sm font-medium text-dim transition-colors hover:bg-surface2 hover:text-soft"
          >
            <span className="text-base leading-none">+</span> {t('day.addExercise')}
          </button>
        </div>
      )}

      <div className="border-t border-edge px-4 py-3">
        <span className="text-xs text-dim2">
          {t('day.count', {
            n: exCount,
            noun: exCount === 1 ? t('day.exerciseOne') : t('day.exercisesMany'),
          })}
        </span>

        {exCount > 0 && (
          <Link
            to={`/entrenar/${day.id}`}
            className="mt-3 flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 shadow-[0_4px_20px_rgba(16,185,129,0.35)] transition-all duration-200 hover:bg-emerald-400 hover:shadow-[0_4px_28px_rgba(16,185,129,0.5)] active:scale-[0.98]"
          >
            {t('day.startTraining')}
          </Link>
        )}
      </div>

      {dialog}
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
  const { pushToast } = useToast()
  const { lang, t } = useLang()
  const [sets, setSets] = useState(item.sets)
  const [reps, setReps] = useState(item.reps ?? '')
  const [rest, setRest] = useState(item.rest_seconds)
  const [saved, setSaved] = useState(false)

  const ex = item.exercise

  const save = async (
    patch: Partial<Pick<RoutineExercise, 'sets' | 'reps' | 'rest_seconds'>>,
  ) => {
    try {
      await onUpdate(patch)
      setSaved(true)
      setTimeout(() => setSaved(false), 1200)
    } catch (err) {
      console.error(err)
      pushToast('error', t('day.saveError'))
    }
  }

  return (
    <SwipeRow actionLabel={t('day.removeAction')} onAction={onRemove} bgClass="bg-surface">
      <li className="flex items-start gap-3 px-4 py-3">
        {ex?.image_url && (
          <img
            src={ex.image_url}
            alt=""
            loading="lazy"
            className="mt-0.5 h-10 w-10 shrink-0 rounded-lg object-cover"
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <Link
              to={`/ejercicios/${ex?.id}`}
              className="line-clamp-2 text-sm font-medium hover:text-emerald-400"
            >
              {ex ? displayName(ex, lang) : t('day.exercise')}
            </Link>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                onClick={onToggleSuperset}
                disabled={item.superset_group == null && !canPair}
                className={`flex min-h-9 min-w-9 items-center justify-center rounded-lg text-sm transition-colors disabled:opacity-30 ${
                  item.superset_group != null
                    ? 'bg-surface2 text-soft ring-1 ring-inset ring-edge2'
                    : 'text-dim2 hover:bg-surface2 hover:text-soft'
                }`}
                title={
                  item.superset_group != null
                    ? t('day.removeSuperset')
                    : t('day.makeSuperset')
                }
              >
                ↔
              </button>
              <button
                onClick={onRemove}
                className="flex min-h-9 min-w-9 items-center justify-center rounded-lg text-sm text-dim2 transition-colors hover:bg-red-500/10 hover:text-red-400"
                title={t('day.removeExercise')}
              >
                ✕
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-nowrap items-center gap-1 overflow-x-auto">
            <input
              type="number"
              min={1}
              value={sets}
              onChange={(e) => setSets(Number(e.target.value))}
              onBlur={() => sets !== item.sets && save({ sets })}
              className="min-h-9 w-11 shrink-0 rounded-lg border border-edge bg-bg px-1.5 text-center text-sm outline-none focus:border-emerald-500"
              title={t('day.sets')}
            />
            <span className="whitespace-nowrap text-xs text-dim2">{t('day.setsShort')}</span>
            <span className="text-dim4">·</span>
            <input
              type="text"
              value={reps}
              onChange={(e) => setReps(e.target.value)}
              onBlur={() => reps !== item.reps && save({ reps })}
              className="min-h-9 w-11 shrink-0 rounded-lg border border-edge bg-bg px-1.5 text-center text-sm outline-none focus:border-emerald-500"
              title={t('day.reps')}
            />
            <span className="whitespace-nowrap text-xs text-dim2">{t('day.repsShort')}</span>
            <span className="text-dim4">·</span>
            <input
              type="number"
              min={0}
              step={15}
              value={rest}
              onChange={(e) => setRest(Number(e.target.value))}
              onBlur={() => rest !== item.rest_seconds && save({ rest_seconds: rest })}
              className="min-h-9 w-12 shrink-0 rounded-lg border border-edge bg-bg px-1.5 text-center text-sm outline-none focus:border-emerald-500"
              title={t('day.rest')}
            />
            <span className="whitespace-nowrap text-xs text-dim2">{t('day.sec')}</span>
            {saved && <span className="shrink-0 text-xs text-dim">✓</span>}
          </div>
        </div>
      </li>
    </SwipeRow>
  )
}
