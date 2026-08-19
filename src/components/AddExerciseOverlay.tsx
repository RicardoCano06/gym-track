import { useEffect, useState } from 'react'
import { categories, equipmentKinds } from '@/lib/catalog'
import { fetchEquipment, fetchExercises } from '@/lib/db'
import type { Equipment, Exercise, RoutineDay } from '@/lib/types'
import BodyMap from '@/components/BodyMap'
import { useToast } from '@/lib/toast-context'

interface Props {
  day: RoutineDay
  onClose: () => void
  onAdd: (exercise: Exercise) => void
}

export default function AddExerciseOverlay({ day, onClose, onAdd }: Props) {
  const { pushToast } = useToast()
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('')
  const [kind, setKind] = useState('')
  const [category, setCategory] = useState('')
  const [results, setResults] = useState<Exercise[]>([])
  const [total, setTotal] = useState(0)
  const [searched, setSearched] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [kinds, setKinds] = useState<string[]>([])
  const [showBodyMap, setShowBodyMap] = useState(true)
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
    if (showBodyMap && !query.trim() && !kind && !category) {
      setResults([])
      setTotal(0)
      setSearched(false)
      return
    }
    let cancelled = false
    const t = setTimeout(() => {
      setFetching(true)
      fetchExercises({ search: query.trim(), group, equipmentKind: kind, category }, 0)
        .then((res) => {
          if (cancelled) return
          setResults(res.exercises)
          setTotal(res.total)
          setSearched(true)
        })
        .catch(console.error)
        .finally(() => {
          if (!cancelled) setFetching(false)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [query, group, kind, category, showBodyMap])

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
    pushToast('success', `"${ex.name}" agregado`)
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      <div className="flex items-center gap-3 border-b border-edge px-4 py-3">
        <button
          onClick={onClose}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-dim transition-colors hover:bg-surface2 hover:text-high"
        >
          ✕
        </button>
        <h2 className="flex-1 text-lg font-bold">Agregar ejercicio</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {showBodyMap && !hasFilters ? (
          <div className="flex flex-col items-center gap-6 px-4 py-6">
            <p className="text-sm text-dim2">Seleccioná un grupo muscular</p>
            <BodyMap onSelectGroup={handleGroupSelect} selectedGroup={group} />
            <p className="text-xs text-dim3">o buscá por nombre más abajo</p>
            <div className="w-full max-w-md">
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  if (e.target.value.trim()) setShowBodyMap(false)
                }}
                placeholder="Buscá por nombre (ej: press, sentadilla...)"
                className="w-full rounded-xl border border-edge bg-surface px-4 py-3 text-sm outline-none transition-colors placeholder:text-dim3 focus:border-emerald-500"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-3 p-4">
            <div className="flex gap-2">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscá por nombre..."
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
                    setShowBodyMap(true)
                  }}
                  className="flex min-h-11 items-center rounded-xl border border-edge px-3 text-sm text-dim2 transition-colors hover:bg-surface2"
                >
                  Limpiar
                </button>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              {group && (
                <span className="flex min-h-11 shrink-0 items-center gap-1 rounded-full border border-emerald-500 bg-emerald-500/15 px-3.5 text-sm font-medium text-emerald-400">
                  {group.charAt(0).toUpperCase() + group.slice(1)}
                  <button
                    onClick={() => setGroup('')}
                    className="ml-1 text-emerald-400/60 hover:text-emerald-400"
                  >
                    ✕
                  </button>
                </span>
              )}
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value)}
                className="min-h-11 shrink-0 rounded-xl border border-edge bg-surface px-3 text-sm text-soft outline-none focus:border-emerald-500"
              >
                <option value="">Todos los equipos</option>
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {equipmentKinds[k] ?? k}
                  </option>
                ))}
              </select>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="min-h-11 shrink-0 rounded-xl border border-edge bg-surface px-3 text-sm text-soft outline-none focus:border-emerald-500"
              >
                <option value="">Todas las categorías</option>
                {Object.entries(categories).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-dim2">
                {searched
                  ? `${total} resultado${total === 1 ? '' : 's'}`
                  : ''}
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
                      <p className="truncate text-sm font-medium">{ex.name}</p>
                      <p className="mt-0.5 truncate text-xs text-dim2">
                        {ex.category}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : searched ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <p className="text-sm font-medium text-soft">Sin resultados</p>
                {hasFilters && (
                  <button
                    onClick={() => {
                      setQuery('')
                      setGroup('')
                      setKind('')
                      setCategory('')
                      setShowBodyMap(true)
                    }}
                    className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-400"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
