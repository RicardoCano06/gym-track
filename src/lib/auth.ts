// Sesión: logout con purga total del lienzo demo y cierre de sesión local.
import { supabase } from '@/lib/supabase'
import { purgeDemoLocal, setDemoMode } from '@/lib/demo'
import { resetDemoData } from '@/lib/demoData'

export const SESSION_CLEARED_EVENT = 'gymtrack:session-cleared'
export const DEMO_LOCAL_EVENT = 'gymtrack:demo-local'

/**
 * Cierra la sesión actual. Si había modo demo activo (online o local), purga
 * primero IndexedDB ("vekt-local") y las claves de sync/estado para que el
 * próximo usuario real arranque con un lienzo en blanco.
 */
export async function logout() {
  await purgeDemoLocal()
  resetDemoData()
  setDemoMode(false)
  try {
    await supabase.auth.signOut()
  } catch {
    // sin red: la sesión local ya se purgó; el evento de abajo completa el cierre
  }
  window.dispatchEvent(new CustomEvent(SESSION_CLEARED_EVENT))
}