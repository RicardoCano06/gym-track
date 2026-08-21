import { supabase } from '@/lib/supabase'
import { isDemoMode } from '@/lib/demo'

export interface PendingOp {
  id: string
  kind: string
  payload: Record<string, unknown>
  retries: number
  createdAt: string
  availableAt?: number
  userId: string | null
}

export function genId(): string {
  try {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  } catch {
    // sin crypto: se cae al fallback
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

const QUEUE_PREFIX = 'gymtrack-sync-queue-'
const LOCK_PREFIX = 'gymtrack-sync-lock-'
const PAUSE_PREFIX = 'gymtrack-sync-paused-'
const LOCK_TTL = 2500
const LOCK_HEARTBEAT = 800
const OP_TIMEOUT = 15000
const MAX_BACKOFF = 15000
const QUEUE_TTL_MS = 30 * 24 * 60 * 60 * 1000

let queue: PendingOp[] = loadQueue()
let flushTimer: number | null = null
let flushing = false
let hasLock = false
let lockOwner = ''
let lockHeartbeat: number | null = null
let paused = loadPaused()
let currentUserId: string | null = null
const inFlight = new Set<string>()

const listeners = new Set<() => void>()
const executors = new Map<string, (op: PendingOp, signal: AbortSignal) => Promise<void>>()

type OpKey = (payload: Record<string, unknown>) => string | null

// Coalescing de ediciones: multiples upsert sobre la misma entidad se fusionan,
// el ultimo estado reemplaza al pendiente (una sola peticion por entidad).
const UPSERT_MERGE: Record<string, OpKey> = {
  session_set_upsert: (p) => (typeof p.id === 'string' ? p.id : null),
  body_metric_upsert: (p) =>
    typeof p.user_id === 'string' && typeof p.date === 'string'
      ? `${p.user_id}|${p.date}`
      : null,
}

// Coalescing upsert -> delete: si el delete llega con el upsert aun pendiente
// (sin emitir a la red), el upsert se cancela y el delete no se encola.
const DELETE_CANCELS: Record<string, string[]> = {
  session_set_delete: ['session_set_upsert'],
}

// Cada cuenta conserva su cola en un namespace propio de localStorage, de modo
// que un cambio de sesion en el mismo dispositivo no descarta ni mezcla las
// mutaciones pendientes de otro usuario.
function userKey(prefix: string): string | null {
  return currentUserId ? `${prefix}${currentUserId}` : null
}

function loadQueue(): PendingOp[] {
  const key = userKey(QUEUE_PREFIX)
  if (!key) return []
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '[]') as PendingOp[]
    return parsed.filter((op) => op.userId === currentUserId)
  } catch {
    return []
  }
}

function saveQueue(next: PendingOp[]) {
  const key = userKey(QUEUE_PREFIX)
  if (!key) return
  queue = next
  try {
    localStorage.setItem(key, JSON.stringify(next))
  } catch {
    // almacenamiento no disponible: la cola vive solo en memoria
  }
}

function loadPaused(): boolean {
  const key = userKey(PAUSE_PREFIX)
  if (!key) return false
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function persistPaused(value: boolean) {
  const key = userKey(PAUSE_PREFIX)
  if (!key) return
  try {
    localStorage.setItem(key, value ? '1' : '0')
  } catch {
    // sin almacenamiento: la pausa vive solo en memoria
  }
}

function removeUserKeys(uid: string) {
  try {
    localStorage.removeItem(QUEUE_PREFIX + uid)
    localStorage.removeItem(LOCK_PREFIX + uid)
    localStorage.removeItem(PAUSE_PREFIX + uid)
  } catch {
    // sin almacenamiento: no hay nada que limpiar
  }
}

// Politica de retencion: las colas de usuarios que no han escrito nada en
// 30 dias se descartan para no agotar la cuota de localStorage en
// dispositivos compartidos. Las colas vacias se limpian de inmediato.
function sweepExpiredQueues() {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k) keys.push(k)
    }
    const users = new Set<string>()
    for (const k of keys) {
      if (k.startsWith(QUEUE_PREFIX)) users.add(k.slice(QUEUE_PREFIX.length))
    }
    for (const uid of users) {
      if (uid === currentUserId) continue
      let lastActive = 0
      try {
        const parsed = JSON.parse(localStorage.getItem(QUEUE_PREFIX + uid) ?? '[]') as PendingOp[]
        if (parsed.length === 0) {
          removeUserKeys(uid)
          continue
        }
        lastActive = Math.max(0, ...parsed.map((o) => new Date(o.createdAt).getTime() || 0))
      } catch {
        removeUserKeys(uid)
        continue
      }
      if (Date.now() - lastActive > QUEUE_TTL_MS) removeUserKeys(uid)
    }
  } catch {
    // sin almacenamiento: no hay colas que barrer
  }
}

function acquireLock(): boolean {
  const key = userKey(LOCK_PREFIX)
  if (!key) return true
  try {
    const now = Date.now()
    const raw = localStorage.getItem(key)
    if (raw) {
      const lock = JSON.parse(raw) as { owner: string; until: number }
      if (lock.until > now) return false
    }
    lockOwner = genId()
    const until = now + LOCK_TTL
    localStorage.setItem(key, JSON.stringify({ owner: lockOwner, until }))
    const check = JSON.parse(localStorage.getItem(key) ?? 'null')
    if (check?.owner !== lockOwner) {
      lockOwner = ''
      return false
    }
    hasLock = true
    startHeartbeat()
    return true
  } catch {
    return true
  }
}

function renewLock() {
  const key = userKey(LOCK_PREFIX)
  if (!hasLock || !lockOwner || !key) return
  try {
    const raw = localStorage.getItem(key)
    const lock = raw ? JSON.parse(raw) : null
    if (lock?.owner !== lockOwner) {
      hasLock = false
      lockOwner = ''
      stopHeartbeat()
      return
    }
    localStorage.setItem(
      key,
      JSON.stringify({ owner: lockOwner, until: Date.now() + LOCK_TTL }),
    )
  } catch {
    // sin almacenamiento: no hay lock que renovar
  }
}

function startHeartbeat() {
  lockHeartbeat = window.setInterval(renewLock, LOCK_HEARTBEAT)
}

function stopHeartbeat() {
  if (lockHeartbeat !== null) {
    clearInterval(lockHeartbeat)
    lockHeartbeat = null
  }
}

function releaseLock() {
  stopHeartbeat()
  const key = userKey(LOCK_PREFIX)
  if (!hasLock || !lockOwner || !key) return
  hasLock = false
  try {
    const raw = localStorage.getItem(key)
    const lock = raw ? JSON.parse(raw) : null
    if (lock?.owner === lockOwner) localStorage.removeItem(key)
  } catch {
    // sin almacenamiento: no hay lock que liberar
  }
  lockOwner = ''
}

function setPaused(value: boolean) {
  if (paused === value) return
  paused = value
  persistPaused(value)
  notify()
  if (!value) scheduleFlush(0)
}

function isAuthError(err: unknown): boolean {
  const e = err as { status?: number; code?: string; message?: string } | null
  if (!e) return false
  if (typeof e.status === 'number' && (e.status === 401 || e.status === 403)) return true
  if (typeof e.code === 'string') {
    const code = e.code.toUpperCase()
    if (code === 'PGRST301' || code === 'PGRST302') return true
    if (
      code === 'INVALID_CREDENTIALS' ||
      code === 'UNAUTHENTICATED' ||
      code === 'PERMISSION_DENIED'
    ) {
      return true
    }
  }
  return /jwt|unauthor|forbidden|token.*expired|session.*invalid/i.test(e.message ?? '')
}

// Fallos de red transitorios: AbortError (timeout del AbortSignal), perdida de
// socket (TypeError "Failed to fetch") y variantes. Se reintentan con backoff.
function isNetworkError(err: unknown): boolean {
  const e = err as { name?: string; code?: string; message?: string } | null
  if (!e) return false
  if (e.name === 'AbortError' || e.code === 'ABORT_ERR') return true
  if (e.name === 'TypeError' && /fetch|network|failed to fetch/i.test(e.message ?? '')) {
    return true
  }
  return false
}

// Timeout estricto para liberar el lock aunque la red quede colgada: si la
// promesa no resuelve en `ms`, se abandona (la op queda en la cola y se
// reintenta; las ops son idempotentes) y el lock puede liberarse.
function withTimeout<T>(promise: Promise<T>, ms: number, tag: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      const err = new Error(`sync: timeout ${tag} > ${ms}ms`)
      err.name = 'SyncTimeoutError'
      reject(err)
    }, ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        window.clearTimeout(timer)
        reject(error)
      },
    )
  })
}

function notify() {
  for (const listener of listeners) listener()
}

export function registerExecutor(
  kind: string,
  executor: (op: PendingOp, signal: AbortSignal) => Promise<void>,
) {
  executors.set(kind, executor)
}

export function getPendingCount(): number {
  return queue.length
}

export function isSyncPaused(): boolean {
  return paused
}

export function subscribeSync(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function enqueue(kind: string, payload: Record<string, unknown>) {
  if (!currentUserId) return
  // Blackhole demo: las mutaciones del sandbox jamás salen a la red; el espejo
  // local (demoData) ya escribió el cambio en IndexedDB para feedback instantáneo.
  if (isDemoMode()) return
  const fresh = loadQueue()
  // Coalescing de ediciones: si ya hay un upsert pendiente para la misma
  // entidad, el ultimo estado reemplaza al anterior (una sola peticion).
  const mergeKey = UPSERT_MERGE[kind]?.(payload)
  if (mergeKey) {
    const idx = fresh.findIndex(
      (o) => o.kind === kind && UPSERT_MERGE[kind]?.(o.payload) === mergeKey,
    )
    if (idx >= 0) {
      const updated = [...fresh]
      updated[idx] = { ...updated[idx], payload }
      saveQueue(updated)
      notify()
      scheduleFlush(0)
      return
    }
  }
  const cancelKinds = DELETE_CANCELS[kind]
  if (cancelKinds) {
    const target = typeof payload.id === 'string' ? payload.id : null
    if (target) {
      const idx = fresh.findIndex(
        (o) => cancelKinds.includes(o.kind) && o.payload.id === target,
      )
      if (idx >= 0 && !inFlight.has(fresh[idx].id)) {
        // Upsert aun pendiente (sin emitir): se cancela y el delete no se
        // encola; la entidad nunca llego a la base de datos.
        saveQueue(fresh.filter((_, i) => i !== idx))
        notify()
        scheduleFlush(0)
        return
      }
      // Upsert en vuelo: no se cancela. El delete se encola despues, y como el
      // reintento del upsert conserva su posicion original (antes del delete),
      // el orden upsert -> delete garantiza que la serie no "resucite".
    }
  }
  const op: PendingOp = {
    id: genId(),
    kind,
    payload,
    retries: 0,
    createdAt: new Date().toISOString(),
    userId: currentUserId,
  }
  saveQueue([...fresh, op])
  notify()
  scheduleFlush(0)
}

export function enqueueDelayed(
  kind: string,
  payload: Record<string, unknown>,
  delayMs: number,
) {
  if (!currentUserId) return
  if (isDemoMode()) return
  const op: PendingOp = {
    id: genId(),
    kind,
    payload,
    retries: 0,
    createdAt: new Date().toISOString(),
    availableAt: Date.now() + delayMs,
    userId: currentUserId,
  }
  saveQueue([...loadQueue(), op])
  notify()
  scheduleFlush(0)
}

export function dequeue(predicate: (op: PendingOp) => boolean) {
  const fresh = loadQueue()
  const filtered = fresh.filter((op) => !predicate(op))
  if (filtered.length !== fresh.length) {
    saveQueue(filtered)
    notify()
  }
}

function scheduleFlush(delayMs: number) {
  scheduleFlushAt(Date.now() + delayMs)
}

function scheduleFlushAt(at: number) {
  if (flushTimer !== null) return
  const delay = Math.max(0, at - Date.now())
  flushTimer = window.setTimeout(() => {
    flushTimer = null
    void flush()
  }, delay)
}

async function flushInner() {
  const now = Date.now()
  const ops = loadQueue()
  const due = ops.filter((op) => (op.availableAt ?? 0) <= now)
  if (due.length === 0) {
    const future = ops.filter((op) => (op.availableAt ?? 0) > now)
    if (future.length > 0) {
      scheduleFlushAt(Math.min(...future.map((op) => op.availableAt ?? 0)))
    }
    return
  }
  for (const op of due) {
    // Releer desde localStorage justo antes de ejecutar: si otra pestaña
    // deshizo (dequeue) la operación, esta ya no está y no debe salir a red.
    const current = loadQueue()
    if (!current.some((q) => q.id === op.id)) continue
    if (op.userId !== currentUserId) continue
    // Blackhole demo: la op se marca como "sincronizada" descartándola de la
    // cola sin emitir NINGÚN fetch a Supabase (defensa de profundidad; en modo
    // demo las escrituras ya van al espejo local y nunca llegan a enqueue).
    if (isDemoMode()) {
      saveQueue(loadQueue().filter((q) => q.id !== op.id))
      notify()
      continue
    }
    const executor = executors.get(op.kind)
    if (!executor) continue
    // AbortController: el timeout aborta el fetch subyacente (cierre fisico del
    // socket) ademas del backstop logico de withTimeout, para que la Pestana B
    // no encuentre peticiones HTTP huerfanas al reejecutar la misma op.
    const ac = new AbortController()
    const abortTimer = window.setTimeout(() => ac.abort(), OP_TIMEOUT)
    inFlight.add(op.id)
    try {
      await withTimeout(executor(op, ac.signal), OP_TIMEOUT, op.kind)
      saveQueue(loadQueue().filter((q) => q.id !== op.id))
      notify()
    } catch (err) {
      // AbortError (timeout con AbortSignal) y perdida de socket (TypeError de
      // fetch) son fallos transitorios de red: se reintentan con backoff y
      // nunca se interpretan como error de autenticacion.
      if (!isNetworkError(err) && isAuthError(err)) {
        setPaused(true)
        return
      }
      op.retries += 1
      saveQueue(loadQueue().map((q) => (q.id === op.id ? op : q)))
      notify()
      scheduleFlush(Math.min(MAX_BACKOFF, 1000 * 2 ** Math.min(op.retries, 4)))
      return
    } finally {
      window.clearTimeout(abortTimer)
      if (!ac.signal.aborted) ac.abort()
      inFlight.delete(op.id)
    }
  }
}

async function flushLocalStorageLocked() {
  if (!acquireLock()) {
    scheduleFlush(200)
    return
  }
  try {
    await flushInner()
  } finally {
    releaseLock()
  }
}

async function flush() {
  if (flushing || paused || !currentUserId) return
  flushing = true
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.locks?.request === 'function') {
      // Web Locks: exclusion mutua entre pestanas sin depender de timers del
      // event loop. El lock se mantiene mientras el callback este pendiente
      // aunque la pestana se congele; se libera al completar o destruirse.
      await navigator.locks.request(`gymtrack-sync-${currentUserId}`, async () => {
        if (paused) return
        await flushInner()
      })
    } else {
      await flushLocalStorageLocked()
    }
  } catch {
    // fallback ante fallo de Web Locks
    await flushLocalStorageLocked()
  } finally {
    flushing = false
    if (!paused && loadQueue().length > 0 && flushTimer === null) scheduleFlush(0)
  }
}

function applySession(userId: string | null) {
  currentUserId = userId
  queue = loadQueue()
  paused = loadPaused()
  if (userId && paused) {
    paused = false
    persistPaused(false)
  }
  sweepExpiredQueues()
  notify()
  if (userId) scheduleFlush(0)
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === null) {
      // localStorage.clear(): el storage entero se limpio en otra pestana.
      // Recargar todo desde disco y soltar cualquier lock en memoria.
      releaseLock()
      queue = loadQueue()
      paused = loadPaused()
      notify()
      scheduleFlush(0)
      return
    }
    if (e.key === userKey(QUEUE_PREFIX)) {
      queue = loadQueue()
      notify()
      scheduleFlush(0)
    } else if (e.key === userKey(PAUSE_PREFIX)) {
      paused = loadPaused()
      notify()
    }
  })
  sweepExpiredQueues()
  supabase.auth.getSession().then(({ data }) => {
    applySession(data.session?.user.id ?? null)
  })
  supabase.auth.onAuthStateChange((_event, session) => {
    applySession(session?.user.id ?? null)
  })
  window.addEventListener('online', () => scheduleFlush(0))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleFlush(0)
  })
  if (navigator.onLine) scheduleFlush(0)
}

// ---------- Ejecutores ----------

registerExecutor('session_set_upsert', async (op, signal) => {
  const { error } = await supabase
    .from('session_sets')
    .upsert(op.payload as never, { onConflict: 'id' })
    .abortSignal(signal)
  if (error) throw error
})

registerExecutor('session_set_delete', async (op, signal) => {
  const { id } = op.payload as { id: string }
  const { error } = await supabase.from('session_sets').delete().eq('id', id).abortSignal(signal)
  if (error) throw error
})

registerExecutor('session_finish', async (op, signal) => {
  const payload = op.payload as {
    id: string
    ended_at: string
    duration_minutes: number
    feeling: number | null
    notes?: string
  }
  const { error } = await supabase
    .from('sessions')
    .update({
      ended_at: payload.ended_at,
      duration_minutes: payload.duration_minutes,
      feeling: payload.feeling,
      notes: payload.notes,
    })
    .eq('id', payload.id)
    .abortSignal(signal)
  if (error) throw error
})

registerExecutor('body_metric_upsert', async (op, signal) => {
  const { error } = await supabase
    .from('body_metrics')
    .upsert(op.payload as never, { onConflict: 'user_id,date' })
    .abortSignal(signal)
  if (error) throw error
})

registerExecutor('routine_exercise_remove', async (op, signal) => {
  const { id } = op.payload as { id: string }
  const { error } = await supabase.from('routine_exercises').delete().eq('id', id).abortSignal(signal)
  if (error) throw error
})