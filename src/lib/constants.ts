export const WEEKDAYS = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
] as const

export type Weekday = (typeof WEEKDAYS)[number]

export function weekdayLabel(weekday: string | null | undefined): string {
  if (!weekday) return ''
  return weekday.charAt(0).toUpperCase() + weekday.slice(1)
}