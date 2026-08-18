import { Link } from 'react-router-dom'
import type { Exercise } from '@/lib/types'

interface Props {
  exercise: Exercise
  muscleName: (id: number) => string
}

export default function ExerciseCard({ exercise, muscleName }: Props) {
  return (
    <Link
      to={`/ejercicios/${exercise.id}`}
      className="group overflow-hidden rounded-xl border border-edge bg-surface transition-colors hover:border-emerald-500/50 hover:bg-surface2/60"
    >
      <div className="aspect-square overflow-hidden bg-surface2">
        {exercise.image_url ? (
          <img
            src={exercise.image_url}
            alt={exercise.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">🏋️</div>
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
          {exercise.name}
        </h3>
        {exercise.muscle_primary != null && (
          <p className="mt-1 text-xs text-dim">
            {muscleName(exercise.muscle_primary)}
          </p>
        )}
      </div>
    </Link>
  )
}