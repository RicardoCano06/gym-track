// Almacén local del Demo Sandbox: IndexedDB "vekt-local" + caché en memoria.
//
// Persiste el espejo de datos demo (rutinas, sesiones, series, métricas) y el
// catálogo embebido. Se purga por completo al salir del modo demo, de modo
// que el próximo usuario real arranca con un lienzo en blanco.

export const DEMO_DB_NAME = 'vekt-local'

const STORE = 'rows'

let dbPromise: Promise<IDBDatabase> | null = null
let dbInstance: IDBDatabase | null = null
const cache = new Map<string, Map<string, unknown>>()
let loaded = false

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    try {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB no disponible'))
        return
      }
      const req = indexedDB.open(DEMO_DB_NAME, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'key' })
        }
      }
      req.onsuccess = () => {
        dbInstance = req.result
        resolve(req.result)
      }
      req.onerror = () => reject(req.error ?? new Error('fallo al abrir vekt-local'))
    } catch (err) {
      reject(err instanceof Error ? err : new Error('IndexedDB no disponible'))
    }
  })
  return dbPromise
}

/**
 * Cierra la conexión y descarta caché en memoria. Indispensable antes de
 * indexedDB.deleteDatabase('vekt-local'): una conexión abierta bloquearía
 * el borrado (onblocked) y la purga quedaría silenciosamente fallida.
 */
export function closeDemoDb() {
  try {
    dbInstance?.close()
  } catch {
    // ya cerrada
  }
  dbInstance = null
  dbPromise = null
  cache.clear()
  loaded = false
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const req = fn(tx.objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('fallo en vekt-local'))
  })
}

function key(table: string, id: string): string {
  return `${table}:${id}`
}

export async function loadAll<T>(table: string): Promise<T[]> {
  if (loaded && cache.has(table)) {
    return [...cache.get(table)!.values()] as T[]
  }
  const rows = await run<unknown[]>( 'readonly', (s) => s.getAll())
  for (const row of rows as { key: string; data: unknown }[]) {
    const idx = row.key.indexOf(':')
    const t = row.key.slice(0, idx)
    const id = row.key.slice(idx + 1)
    if (!cache.has(t)) cache.set(t, new Map())
    cache.get(t)!.set(id, row.data)
  }
  loaded = true
  if (!cache.has(table)) cache.set(table, new Map())
  return [...cache.get(table)!.values()] as T[]
}

export async function put<T>(table: string, id: string, data: T) {
  if (!cache.has(table)) cache.set(table, new Map())
  cache.get(table)!.set(id, data)
  await run('readwrite', (s) => s.put({ key: key(table, id), data }))
}

export async function remove(table: string, id: string) {
  cache.get(table)?.delete(id)
  await run('readwrite', (s) => s.delete(key(table, id)))
}

export async function clearStore() {
  cache.clear()
  loaded = false
  try {
    await run('readwrite', (s) => s.clear())
  } catch {
    // sin IndexedDB: la caché en memoria ya quedó limpia
  }
}

/** Pone el caché en memoria como único medio (para pruebas sin IndexedDB). */
export function setInMemoryOnly() {
  loaded = true
}