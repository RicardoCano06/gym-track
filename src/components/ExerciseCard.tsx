import { Link } from 'react-router-dom'
import type { Exercise } from '@/lib/types'
import { displayName } from '@/lib/i18n'
import { useLang } from '@/lib/lang-context'

interface Props {
  exercise: Exercise
  muscleName: (id: number) => string
}

export default function ExerciseCard({ exercise, muscleName }: Props) {
  const { lang } = useLang()
  const name = displayName(exercise, lang)

  return (
    <Link
      to={`/ejercicios/${exercise.id}`}
      className="card-hairline glass-card group overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/50 hover:shadow-[0_0_28px_rgba(16,185,129,0.14)]"
    >
      <div className="aspect-square overflow-hidden bg-surface2">
        {exercise.image_url ? (
          <img
            src={exercise.image_url}
            alt={name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl">🏋️</div>
        )}
      </div>
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-high">
          {name}
        </h3>
        {exercise.muscle_primary != null && (
          <span className="mt-2 inline-block rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/25">
            {muscleName(exercise.muscle_primary)}
          </span>
        )}
      </div>
    </Link>
  )
}
