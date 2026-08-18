interface Props {
  title: string
  description: string
  emoji: string
  next?: string
}

export default function Placeholder({ title, description, emoji, next }: Props) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
      <div className="text-6xl">{emoji}</div>
      <h1 className="mt-6 text-2xl font-bold">{title}</h1>
      <p className="mt-2 max-w-md text-dim">{description}</p>
      {next && (
        <p className="mt-6 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-400">
          {next}
        </p>
      )}
    </div>
  )
}