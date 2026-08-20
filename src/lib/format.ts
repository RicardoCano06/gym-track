export function formatShortDate(date: string, lang: 'es' | 'en' = 'es'): string {
  return new Date(date).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-AR', {
    day: 'numeric',
    month: 'short',
  })
}