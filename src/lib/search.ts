// Normalización de texto para búsquedas "blancas": minúsculas y sin diacríticos.
// Permite que "jalon" encuentre "Jalón", "press" encuentre "Press", etc.
export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}