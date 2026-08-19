import { useEffect, useState } from 'react'
import { categories, equipmentKinds, muscleGroupOrder, muscleGroups } from '@/lib/catalog'
import { fetchEquipment, fetchExercises } from '@/lib/db'
import type { Equipment, Exercise, RoutineDay } from '@/lib/types'

interface Props {
  day: RoutineDay
  onAddExercise: (day: RoutineDay, exercise: Exercise) => void
}

export default function AddExerciseInline({ day, onAddExercise }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('')
  const [kind, setKind] = useState('')
  const [category, setCategory] = useState('')
  const [results, setResults] = useState<Exercise[]>([])
  const [total, setTotal] = useState(0)
  const [searched, setSearched] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [kinds, setKinds] = useState<string[]>([])

  useEffect(() => {
    fetchEquipment()
      .then((eqs) => setKinds([...new Set(eqs.map((e: Equipment) => e.kind))]))
      .catch(console.error)
  }, [])

  useEffect(() => {
    if (!open) return
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
  }, [open, query, group, kind, category])

  const alreadyAdded = new Set((day.exercises ?? []).map((re) => re.exercise_id))
  const shown = results.filter((ex) => !alreadyAdded.has(ex.id))
  const hasFilters = !!(query.trim() || group || kind || category)

  const clearFilters = () => {
    setQuery('')
    setGroup('')
    setKind('')
    setCategory('')
  }

  return (
    <div className="border-t border-edge bg-bg/40">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center justify-between px-4 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/5"
      >
        <span>{open ? 'Ocultar buscador' : '+ Agregar ejercicio'}</span>
        <span className="text-base leading-none">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="space-y-3 border-t border-edge/60 p-4">
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscá por nombre (ej: press, sentadilla...)"
            className="w-full rounded-lg border border-edge2 bg-bg px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-dim3 focus:border-emerald-500"
          />

          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setGroup('')}
              className={`flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors ${
                !group
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                  : 'border-edge bg-surface text-dim'
              }`}
            >
              Todo
            </button>
            {muscleGroupOrder.map((g) => (
              <button
                key={g}
                onClick={() => setGroup(group === g ? '' : g)}
                className={`flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-sm font-medium transition-colors ${
                  group === g
                    ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                    : 'border-edge bg-surface text-dim'
                }`}
              >
                {muscleGroups[g]}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="min-h-11 rounded-lg border border-edge bg-surface px-3 text-sm text-soft outline-none focus:border-emerald-500"
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
              className="min-h-11 rounded-lg border border-edge bg-surface px-3 text-sm text-soft outline-none focus:border-emerald-500"
            >
              <option value="">Todas las categorías</option>
              {Object.entries(categories).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="min-h-11 rounded-lg px-3 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-500/5"
              >
                Limpiar
              </button>
            )}
          </div>

          <div className="h-60 overflow-y-auto rounded-lg border border-edge bg-bg/50">
            {fetching ? (
              <p className="flex h-full items-center justify-center px-4 text-sm text-dim2">
                Buscando...
              </p>
            ) : !searched ? (
              <p className="flex h-full items-center justify-center px-4 text-center text-sm text-dim2">
                Buscá un ejercicio o usá los filtros para encontrarlo
              </p>
            ) : shown.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center">
                <p className="text-sm font-medium text-soft">Sin resultados</p>
                {hasFilters && (
                  <button
                    onClick={clearFilters}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-400"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            ) : (
              <>
                <p className="border-b border-edge/60 px-3 py-1.5 text-xs text-dim2">
                  {total} resultado{total === 1 ? '' : 's'}
                </p>
                <ul className="divide-y divide-edge/60">
                  {shown.slice(0, 30).map((ex) => (
                    <li key={ex.id} className="flex items-center gap-3 px-2 py-1.5">
                      {ex.image_url && (
                        <img
                          src={ex.image_url}
                          alt=""
                          loading="lazy"
                          className="h-10 w-10 shrink-0 rounded-md object-cover"
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{ex.name}</p>
                        <p className="text-xs text-dim2">{ex.category}</p>
                      </div>
                      <button
                        onClick={() => onAddExercise(day, ex)}
                        aria-label={`Agregar ${ex.name}`}
                        className="flex min-h-11 shrink-0 items-center rounded-lg bg-emerald-500/15 px-3 text-sm font-semibold text-emerald-400 transition-colors hover:bg-emerald-500 hover:text-neutral-950"
                      >
                        +
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}