export function formatShortDate(date: string): string {
  return new Date(date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}