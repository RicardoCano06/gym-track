import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { categories, muscleGroupOrder } from '@/lib/catalog'
import { fetchEquipment, fetchExercises } from '@/lib/db'
import type { Equipment, Exercise, RoutineDay } from '@/lib/types'
import BodyMap from '@/components/BodyMap'
import { useToast } from '@/lib/toast-context'
import { displayName } from '@/lib/i18n'
import { useLang } from '@/lib/lang-context'

interface Props {
  day: RoutineDay
  onClose: () => void
  onAdd: (exercise: Exercise) => void
}

export default function AddExerciseOverlay({ day, onClose, onAdd }: Props) {
  const { pushToast } = useToast()
  const { lang, t } = useLang()
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('')
  const [kind, setKind] = useState('')
  const [category, setCategory] = useState('')
  const [results, setResults] = useState<Exercise[]>([])
  const [total, setTotal] = useState(0)
  const [searched, setSearched] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [kinds, setKinds] = useState<string[]>([])
  const [showBodyMap, setShowBodyMap] = useState(false)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    fetchEquipment()
      .then((eqs) => {
        setKinds([...new Set(eqs.map((e: Equipment) => e.kind))])
      })
      .catch(console.error)
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    if (!query.trim() && !group && !kind && !category) {
      setResults([])
      setTotal(0)
      setSearched(false)
      return
    }
    let cancelled = false
    const timer = setTimeout(() => {
      setFetching(true)
      fetchExercises({ search: query.trim(), group, equipmentKind: kind, category }, 0)
        .then((res) => {
          if (cancelled) return
          setResults(res.exercises)
          setTotal(res.total)
          setSearched(true)
        })
        .catch((err) => {
          console.error(err)
          if (!cancelled) pushToast('error', t('add.searchError'))
        })
        .finally(() => {
          if (!cancelled) setFetching(false)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, group, kind, category, showBodyMap, pushToast, t])

  const alreadyAdded = new Set([
    ...(day.exercises ?? []).map((re) => re.exercise_id),
    ...addedIds,
  ])
  const shown = results.filter((ex) => !alreadyAdded.has(ex.id))
  const hasFilters = !!(query.trim() || group || kind || category)

  function handleGroupSelect(g: string) {
    setGroup(g)
    setShowBodyMap(false)
  }

  function handleAdd(ex: Exercise) {
    onAdd(ex)
    setAddedIds((prev) => new Set(prev).add(ex.id))
    pushToast('success', t('add.added', { name: displayName(ex, lang) }))
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="flex items-center gap-3 border-b border-edge px-4 py-3">
        <button
          onClick={onClose}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-dim transition-colors hover:bg-surface2 hover:text-high"
        >
          ✕
        </button>
        <h2 className="flex-1 text-lg font-bold">{t('add.title')}</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          <div>
            <p className="mb-2 text-sm text-dim2">{t('add.muscleGroup')}</p>
            <div className="flex flex-wrap gap-2">
              {muscleGroupOrder.map((key) => {
                const active = group === key
                return (
                  <button
                    key={key}
                    onClick={() => (active ? setGroup('') : handleGroupSelect(key))}
                    className={`flex min-h-[48px] items-center rounded-full border px-4 text-sm font-medium transition-colors ${
                      active
                        ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                        : 'border-edge bg-surface text-soft hover:border-emerald-500/50'
                    }`}
                  >
                    {t(`group.${key}`)}
                  </button>
                )
              })}
            </div>
            <button
              onClick={() => setShowBodyMap((v) => !v)}
              className="mt-3 text-xs font-medium text-emerald-400 hover:underline"
            >
              {showBodyMap ? t('add.hideBodyMap') : t('add.seeBodyMap')}
            </button>
            {showBodyMap && (
              <div className="mt-3">
                <BodyMap onSelectGroup={handleGroupSelect} selectedGroup={group} />
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('add.searchPlaceholder')}
              autoFocus
              className="flex-1 rounded-xl border border-edge bg-surface px-4 py-3 text-sm outline-none transition-colors placeholder:text-dim3 focus:border-emerald-500"
            />
            {hasFilters && (
              <button
                onClick={() => {
                  setQuery('')
                  setGroup('')
                  setKind('')
                  setCategory('')
                  setShowBodyMap(false)
                }}
                className="flex min-h-11 items-center rounded-xl border border-edge px-3 text-sm text-dim2 transition-colors hover:bg-surface2"
              >
                {t('add.clear')}
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="min-h-11 shrink-0 rounded-xl border border-edge bg-surface px-3 text-sm text-soft outline-none focus:border-emerald-500"
            >
              <option value="">{t('catalog.allEquipment')}</option>
              {kinds.map((k) => (
                <option key={k} value={k}>
                  {t(`eqkind.${k}`)}
                </option>
              ))}
            </select>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="min-h-11 shrink-0 rounded-xl border border-edge bg-surface px-3 text-sm text-soft outline-none focus:border-emerald-500"
            >
              <option value="">{t('catalog.allCategories')}</option>
              {Object.entries(categories).map(([key]) => (
                <option key={key} value={key}>
                  {t(`cat.${key}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-between">
            <p className="text-xs text-dim2">
              {searched ? t('add.results', { n: total, s: total === 1 ? '' : 's' }) : ''}
            </p>
          </div>

          {fetching ? (
            <div className="flex items-center justify-center py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-edge2 border-t-emerald-500" />
            </div>
          ) : shown.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {shown.slice(0, 40).map((ex) => (
                <button
                  key={ex.id}
                  onClick={() => handleAdd(ex)}
                  className="group flex flex-col overflow-hidden rounded-xl border border-edge bg-surface text-left transition-colors hover:border-emerald-500/50 hover:bg-surface2"
                >
                  {ex.image_url ? (
                    <img
                      src={ex.image_url}
                      alt=""
                      loading="lazy"
                      className="aspect-square w-full object-cover"
                    />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center bg-surface2 text-2xl text-dim2">
                      🏋️
                    </div>
                  )}
                  <div className="px-3 py-2.5">
                    <p className="truncate text-sm font-medium">
                      {displayName(ex, lang)}
                    </p>
                    {ex.category && (
                      <p className="mt-0.5 truncate text-xs text-dim2">
                        {t(`cat.${ex.category}`)}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : searched ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <p className="text-sm font-medium text-soft">{t('add.noResults')}</p>
              {hasFilters && (
                <button
                  onClick={() => {
                    setQuery('')
                    setGroup('')
                    setKind('')
                    setCategory('')
                    setShowBodyMap(false)
                  }}
                  className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-400"
                >
                  {t('add.clearFilters')}
                </button>
              )}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-dim2">
              {t('add.initialHint')}
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
