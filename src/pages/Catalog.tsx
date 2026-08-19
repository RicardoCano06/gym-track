import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ExerciseCard from '@/components/ExerciseCard'
import ErrorState from '@/components/ErrorState'
import { categories, equipmentKinds, muscleGroupOrder, muscleGroups } from '@/lib/catalog'
import { fetchEquipment, fetchExercises, fetchMuscles } from '@/lib/db'
import type { Equipment, Exercise, Muscle } from '@/lib/types'

export default function Catalog() {
  const [params, setParams] = useSearchParams()
  const search = params.get('q') ?? ''
  const group = params.get('grupo') ?? ''
  const kind = params.get('equipo') ?? ''
  const category = params.get('categoria') ?? ''

  const [muscles, setMuscles] = useState<Muscle[]>([])
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [searchInput, setSearchInput] = useState(search)

  useEffect(() => {
    fetchMuscles().then(setMuscles).catch(console.error)
    fetchEquipment().then(setEquipment).catch(console.error)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params)
      if (searchInput.trim()) next.set('q', searchInput.trim())
      else next.delete('q')
      setParams(next, { replace: true })
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchExercises({ search, group, equipmentKind: kind, category }, 0)
      .then((res) => {
        setExercises(res.exercises)
        setTotal(res.total)
      })
      .catch((err) => {
        console.error(err)
        setError('No pudimos cargar el catálogo de ejercicios')
      })
      .finally(() => setLoading(false))
  }, [search, group, kind, category])

  useEffect(() => {
    setPage(0)
    load()
  }, [load])

  const loadMore = useCallback(async () => {
    const next = page + 1
    const res = await fetchExercises({ search, group, equipmentKind: kind, category }, next)
    setExercises((prev) => [...prev, ...res.exercises])
    setTotal(res.total)
    setPage(next)
  }, [page, search, group, kind, category])

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next)
  }

  const hasFilters = !!(search || group || kind || category)

  const clearFilters = () => {
    setParams(new URLSearchParams())
    setSearchInput('')
  }

  const muscleName = useCallback(
    (id: number) => muscles.find((m) => m.id === id)?.name ?? '—',
    [muscles],
  )

  const kinds = [...new Set(equipment.map((e) => e.kind))]

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Catálogo de ejercicios</h1>
        <p className="mt-1 text-sm text-dim">
          {total > 0
            ? `${total} ejercicios encontrados`
            : '873 ejercicios disponibles, con fotos e instrucciones'}
        </p>
      </header>

      <div className="sticky top-14 z-20 -mx-4 space-y-3 border-b border-edge bg-bg/90 px-4 pb-3 pt-2 backdrop-blur md:top-0 md:-mx-8 md:px-8">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Buscar ejercicio (ej: press, dominada, gemelos...)"
          className="w-full rounded-lg border border-edge bg-surface px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-dim2 focus:border-emerald-500"
        />

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setFilter('grupo', '')}
            className={`flex min-h-11 items-center whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
              !group
                ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                : 'border-edge bg-surface text-dim hover:text-high'
            }`}
          >
            Todo
          </button>
          {muscleGroupOrder.map((g) => (
            <button
              key={g}
              onClick={() => setFilter('grupo', group === g ? '' : g)}
              className={`flex min-h-11 items-center whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                group === g
                  ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400'
                  : 'border-edge bg-surface text-dim hover:text-high'
              }`}
            >
              {muscleGroups[g]}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={kind}
            onChange={(e) => setFilter('equipo', e.target.value)}
            className="min-h-11 rounded-lg border border-edge bg-surface px-3 py-1.5 text-sm text-soft outline-none focus:border-emerald-500"
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
            onChange={(e) => setFilter('categoria', e.target.value)}
            className="min-h-11 rounded-lg border border-edge bg-surface px-3 py-1.5 text-sm text-soft outline-none focus:border-emerald-500"
          >
            <option value="">Todas las categorías</option>
            {Object.entries(categories).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-xl border border-edge bg-surface"
            >
              <div className="aspect-square bg-surface2" />
              <div className="space-y-2 p-3">
                <div className="h-3 w-3/4 rounded bg-surface2" />
                <div className="h-2.5 w-1/2 rounded bg-surface2" />
              </div>
            </div>
          ))}
        </div>
      ) : exercises.length === 0 ? (
        <div className="mt-16 text-center">
          <div className="text-5xl">🔍</div>
          <p className="mt-4 font-medium">Sin resultados</p>
          <p className="mt-1 text-sm text-dim">
            Probá con otra búsqueda o sacá algún filtro
          </p>
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="mt-6 rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-400"
            >
              Limpiar filtros
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {exercises.map((exercise) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                muscleName={muscleName}
              />
            ))}
          </div>
          {exercises.length < total && (
            <div className="mt-8 text-center">
              <button
                onClick={loadMore}
                className="rounded-lg border border-edge bg-surface px-6 py-2.5 text-sm font-medium text-soft transition-colors hover:border-emerald-500/50 hover:text-strong"
              >
                Cargar más ({exercises.length}/{total})
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}