import { useEffect, useRef, useState } from 'react'
import { fetchExercises } from '@/lib/db'
import type { Exercise } from '@/lib/types'

interface Props {
  onClose: () => void
  onSelect: (exercise: Exercise) => void
}

export default function AddExerciseModal({ onClose, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Exercise[]>([])
  const [searching, setSearching] = useState(false)
  const [searchedFor, setSearchedFor] = useState('')
  const timer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  function handleQueryChange(value: string) {
    setQuery(value)
    if (timer.current) clearTimeout(timer.current)
    const q = value.trim()
    if (!q) {
      setResults([])
      setSearchedFor('')
      setSearching(false)
      return
    }
    setSearching(true)
    const current = window.setTimeout(async () => {
      try {
        const res = await fetchExercises({ search: q }, 0)
        setResults(res.exercises)
        setSearchedFor(q)
      } catch (err) {
        console.error(err)
      } finally {
        setSearching(false)
      }
    }, 300)
    timer.current = current
  }

  const shown = query.trim() === searchedFor ? results : []

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-2xl border border-edge bg-surface sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-edge p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Agregar ejercicio</h2>
            <button
              onClick={onClose}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-dim hover:bg-surface2 hover:text-strong"
            >
              ✕
            </button>
          </div>
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Buscá por nombre (ej: press, sentadilla...)"
            className="mt-3 w-full rounded-lg border border-edge2 bg-bg px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-dim3 focus:border-emerald-500"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {!query.trim() ? (
            <p className="px-3 py-8 text-center text-sm text-dim2">
              Escribí para buscar en el catálogo
            </p>
          ) : searching ? (
            <p className="px-3 py-8 text-center text-sm text-dim2">Buscando...</p>
          ) : shown.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-dim2">
              Sin resultados para "{query}"
            </p>
          ) : (
            <ul className="divide-y divide-edge">
              {shown.map((ex) => (
                <li key={ex.id}>
                  <button
                    onClick={() => onSelect(ex)}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface2"
                  >
                    {ex.image_url && (
                      <img
                        src={ex.image_url}
                        alt=""
                        loading="lazy"
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{ex.name}</p>
                      <p className="text-xs text-dim2">{ex.category}</p>
                    </div>
                    <span className="ml-auto text-dim2">+</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}