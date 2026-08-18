import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useConfirm } from '@/lib/use-confirm'
import { useAuth } from '@/lib/auth-context'
import { createRoutine, deleteRoutine, fetchRoutines } from '@/lib/db'
import type { Routine } from '@/lib/types'

export default function Routines() {
  const { user } = useAuth()
  const { ask, dialog } = useConfirm()
  const [routines, setRoutines] = useState<Routine[]>([])
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    fetchRoutines(user.id)
      .then(setRoutines)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!user || !newName.trim() || creating) return
    setCreating(true)
    try {
      const routine = await createRoutine(user.id, newName.trim())
      setRoutines((prev) => [routine, ...prev])
      setNewName('')
    } catch (err) {
      console.error(err)
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    ask({
      title: 'Eliminar rutina',
      message: `Se borra "${name}" con todos sus días y ejercicios.`,
      confirmLabel: 'Eliminar',
      danger: true,
      onConfirm: async () => {
        setDeleting(id)
        try {
          await deleteRoutine(id)
          setRoutines((prev) => prev.filter((r) => r.id !== id))
        } catch (err) {
          console.error(err)
        } finally {
          setDeleting(null)
        }
      },
    })
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Rutinas</h1>
        <p className="mt-1 text-sm text-dim">
          Tus planes de entrenamiento organizados por día
        </p>
      </header>

      <form onSubmit={handleCreate} className="mb-8 flex gap-2">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nombre de la rutina (ej: Volumen 5 días)"
          className="flex-1 rounded-lg border border-edge bg-surface px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-dim2 focus:border-emerald-500"
        />
        <button
          type="submit"
          disabled={creating || !newName.trim()}
          className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
        >
          Crear
        </button>
      </form>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl border border-edge bg-surface" />
          ))}
        </div>
      ) : routines.length === 0 ? (
        <div className="mt-16 text-center">
          <div className="text-5xl">🗓️</div>
          <p className="mt-4 font-medium">Todavía no tenés rutinas</p>
          <p className="mt-1 text-sm text-dim">
            Creá una arriba y empezá a armar tus días de entrenamiento
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {routines.map((routine) => (
            <div
              key={routine.id}
              className="group relative rounded-xl border border-edge bg-surface p-5 transition-colors hover:border-emerald-500/50"
            >
              <Link to={`/rutinas/${routine.id}`} className="block">
                <h2 className="font-semibold">{routine.name}</h2>
                {routine.description && (
                  <p className="mt-1 text-sm text-dim">{routine.description}</p>
                )}
                <p className="mt-3 text-xs text-dim2">
                  {new Date(routine.created_at).toLocaleDateString('es-AR')}
                </p>
              </Link>
              <button
                onClick={() => handleDelete(routine.id, routine.name)}
                disabled={deleting === routine.id}
                className="absolute right-3 top-3 flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2 text-sm text-dim2 transition-colors hover:bg-red-500/10 hover:text-red-400 md:opacity-0 md:group-hover:opacity-100 disabled:opacity-30"
                title="Eliminar rutina"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      {dialog}
    </div>
  )
}