// Demo Sandbox (1-Click): núcleo del modo demo.
//
// Estrategia: cuando el usuario activo es la cuenta demo, TODA la capa de
// datos (db.ts) se redirige a un espejo local persistido en IndexedDB
// (base "vekt-local"). El motor de sync hace "blackhole" de las ops
// pendientes (nunca tocan Supabase). El cierre de sesión purga el lienzo
// local por completo para que el próximo usuario real arranque limpio.
import type { User } from '@supabase/supabase-js'
import { closeDemoDb, DEMO_DB_NAME } from '@/lib/demoStore'

export const DEMO_EMAIL = 'demo@vekt.app'
export const DEMO_PASSWORD = 'demo-vekt-2026'
export const DEMO_LOCAL_USER_ID = '00000000-0000-4000-8000-00000000d3a0'

const DEMO_FLAG = 'gymtrack-demo'
const DEMO_LOCAL_FLAG = 'gymtrack-demo-local'
const DEMO_USER_KEY = 'gymtrack-demo-user'

/** True cuando la sesión activa pertenece a la cuenta demo (online o local). */
export function isDemoMode(): boolean {
  try {
    return localStorage.getItem(DEMO_FLAG) === '1'
  } catch {
    return false
  }
}

/** True cuando se usa el fallback "demo puramente local" (sin Supabase). */
export function isLocalDemoMode(): boolean {
  try {
    return localStorage.getItem(DEMO_LOCAL_FLAG) === '1'
  } catch {
    return false
  }
}

export function setDemoMode(active: boolean) {
  try {
    if (active) localStorage.setItem(DEMO_FLAG, '1')
    else localStorage.removeItem(DEMO_FLAG)
  } catch {
    // sin almacenamiento: el modo demo vive solo en memoria
  }
}

export function enterLocalDemo() {
  try {
    localStorage.setItem(DEMO_LOCAL_FLAG, '1')
    localStorage.setItem(DEMO_FLAG, '1')
    localStorage.setItem(
      DEMO_USER_KEY,
      JSON.stringify({
        id: DEMO_LOCAL_USER_ID,
        email: DEMO_EMAIL,
        role: 'authenticated',
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      }),
    )
  } catch {
    // sin almacenamiento: sin modo local persistente
  }
}

export function getLocalDemoUser(): User | null {
  try {
    if (localStorage.getItem(DEMO_LOCAL_FLAG) !== '1') return null
    const raw = localStorage.getItem(DEMO_USER_KEY)
    if (!raw) return null
    return JSON.parse(raw) as User
  } catch {
    return null
  }
}

function deleteIndexedDB(name: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve()
        return
      }
      const req = indexedDB.deleteDatabase(name)
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
      req.onblocked = () => resolve()
    } catch {
      resolve()
    }
  })
}

/**
 * Purga total del lienzo demo: IndexedDB "vekt-local" (donde vive el espejo
 * de datos demo) y toda clave local de sesión/sync/estado de la app.
 * Conserva preferencias de dispositivo (idioma y tema).
 */
export async function purgeDemoLocal() {
  // Cerrar primero la conexión del espejo demo: con una conexión abierta,
  // indexedDB.deleteDatabase queda bloqueada (onblocked) y no purga nada.
  closeDemoDb()
  await deleteIndexedDB(DEMO_DB_NAME)
  try {
    const keep = new Set(['gymtrack-lang', 'gymtrack-theme'])
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k) keys.push(k)
    }
    for (const k of keys) {
      if (keep.has(k)) continue
      if (
        k.startsWith('gymtrack-sync-') ||
        k.startsWith('gymtrack-active-set-') ||
        k === DEMO_FLAG ||
        k === DEMO_LOCAL_FLAG ||
        k === DEMO_USER_KEY
      ) {
        localStorage.removeItem(k)
      }
    }
  } catch {
    // sin almacenamiento: no hay nada que purgar
  }
}

export async function exitDemo() {
  setDemoMode(false)
  await purgeDemoLocal()
}