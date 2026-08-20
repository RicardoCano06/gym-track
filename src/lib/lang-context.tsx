import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { messages } from '@/lib/i18n'
import type { Lang } from '@/lib/i18n'

export const LANG_KEY = 'gymtrack-lang'

interface LangContextValue {
  lang: Lang
  locale: string
  setLang: (lang: Lang) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const LangContext = createContext<LangContextValue>({
  lang: 'es',
  locale: 'es-AR',
  setLang: () => {},
  t: (key) => key,
})

function initialLang(): Lang {
  try {
    return (localStorage.getItem(LANG_KEY) ?? 'es') === 'en' ? 'en' : 'es'
  } catch {
    return 'es'
  }
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem(LANG_KEY, lang)
    } catch {
      // almacenamiento no disponible: el idioma vive solo en la sesión
    }
  }, [lang])

  const setLang = useCallback((l: Lang) => setLangState(l), [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      let out = messages[lang][key] ?? messages.es[key] ?? key
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          out = out.replaceAll(`{${k}}`, String(v))
        }
      }
      return out
    },
    [lang],
  )

  return (
    <LangContext.Provider
      value={{ lang, locale: lang === 'en' ? 'en-US' : 'es-AR', setLang, t }}
    >
      {children}
    </LangContext.Provider>
  )
}

export function useLang() {
  return useContext(LangContext)
}