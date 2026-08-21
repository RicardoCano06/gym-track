import { useLang } from '@/lib/lang-context'
import type { Lang } from '@/lib/i18n'

const OPTIONS: { value: Lang; label: string }[] = [
  { value: 'es', label: 'ES' },
  { value: 'en', label: 'EN' },
]

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18" />
    </svg>
  )
}

export default function LanguageToggle({ subtle = false }: { subtle?: boolean }) {
  const { lang, setLang } = useLang()

  if (subtle) {
    return (
      <div role="group" aria-label="Idioma" className="flex items-center gap-0.5">
        {OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={lang === o.value}
            onClick={() => setLang(o.value)}
            title={o.value.toUpperCase()}
            className={`flex h-8 items-center rounded-md px-1.5 text-xs font-medium transition-colors duration-200 ${
              lang === o.value ? 'text-emerald-400' : 'text-dim hover:text-high'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div
      role="group"
      aria-label="Idioma"
      className="relative flex h-11 min-w-28 items-stretch rounded-xl border border-edge bg-surface p-1"
    >
      <span
        aria-hidden
        className={`absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-lg bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/25 transition-transform duration-300 ease-out ${
          lang === 'en' ? 'translate-x-full' : ''
        }`}
      />
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={lang === o.value}
          onClick={() => setLang(o.value)}
          className={`relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-colors duration-200 ${
            lang === o.value ? 'text-emerald-400' : 'text-dim hover:text-soft'
          }`}
        >
          {lang === o.value ? <GlobeIcon className="h-4 w-4" /> : null}
          {o.label}
        </button>
      ))}
    </div>
  )
}
