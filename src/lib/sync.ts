import { supabase } from '@/lib/supabase'

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

const QUEUE_KEY = 'gymtrack-pending-queue'
const LOCK_KEY = 'gymtrack-sync-lock'
const PAUSE_KEY = 'gymtrack-sync-paused'
const LOCK_TTL = 2500
const LOCK_HEARTBEAT = 800
const MAX_BACKOFF = 15000

let queue: PendingOp[] = loadQueue()
let flushTimer: number | null = null
let flushing = false
let hasLock = false
let lockOwner = ''
let lockHeartbeat: number | null = null
let paused = loadPaused()
let currentUserId: string | null = null

const listeners = new Set<() => void>()
const executors = new Map<string, (op: PendingOp) => Promise<void>>()

function loadQueue(): PendingOp[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as PendingOp[]
  } catch {
    return []
  }
}

function saveQueue(next: PendingOp[]) {
  queue = next
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(next))
  } catch {
    // almacenamiento no disponible: la cola vive solo en memoria
  }
}

function loadPaused(): boolean {
  try {
    return localStorage.getItem(PAUSE_KEY) === '1'
  } catch {
    return false
  }
}

function persistPaused(value: boolean) {
  try {
    localStorage.setItem(PAUSE_KEY, value ? '1' : '0')
  } catch {
    // sin almacenamiento: la pausa vive solo en memoria
  }
}

function acquireLock(): boolean {
  try {
    const now = Date.now()
    const raw = localStorage.getItem(LOCK_KEY)
    if (raw) {
      const lock = JSON.parse(raw) as { owner: string; until: number }
      if (lock.until > now) return false
    }
    lockOwner = genId()
    const until = now + LOCK_TTL
    localStorage.setItem(LOCK_KEY, JSON.stringify({ owner: lockOwner, until }))
    const check = JSON.parse(localStorage.getItem(LOCK_KEY) ?? 'null')
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
  if (!hasLock || !lockOwner) return
  try {
    const raw = localStorage.getItem(LOCK_KEY)
    const lock = raw ? JSON.parse(raw) : null
    if (lock?.owner !== lockOwner) {
      hasLock = false
      lockOwner = ''
      stopHeartbeat()
      return
    }
    localStorage.setItem(
      LOCK_KEY,
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
  if (!hasLock || !lockOwner) return
  hasLock = false
  try {
    const raw = localStorage.getItem(LOCK_KEY)
    const lock = raw ? JSON.parse(raw) : null
    if (lock?.owner === lockOwner) localStorage.removeItem(LOCK_KEY)
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

function notify() {
  for (const listener of listeners) listener()
}

export function registerExecutor(
  kind: string,
  executor: (op: PendingOp) => Promise<void>,
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
  const op: PendingOp = {
    id: genId(),
    kind,
    payload,
    retries: 0,
    createdAt: new Date().toISOString(),
    userId: currentUserId,
  }
  saveQueue([...loadQueue(), op])
  notify()
  scheduleFlush(0)
}

export function enqueueDelayed(
  kind: string,
  payload: Record<string, unknown>,
  delayMs: number,
) {
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
  let ops = loadQueue()
  // Aislar operaciones de otra sesion (fuga cross-user): si el user_id no
  // coincide con la sesion activa se descartan sin ejecutarse. Las operaciones
  // viejas sin user_id (versiones previas) tambien se descartan por seguridad.
  const kept = ops.filter((op) => op.userId === currentUserId)
  if (kept.length !== ops.length) {
    saveQueue(kept)
    notify()
    ops = kept
  }
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
    const executor = executors.get(op.kind)
    if (!executor) continue
    try {
      await executor(op)
      saveQueue(loadQueue().filter((q) => q.id !== op.id))
      notify()
    } catch (err) {
      if (isAuthError(err)) {
        setPaused(true)
        return
      }
      op.retries += 1
      saveQueue(loadQueue().map((q) => (q.id === op.id ? op : q)))
      notify()
      scheduleFlush(Math.min(MAX_BACKOFF, 1000 * 2 ** Math.min(op.retries, 4)))
      return
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
  if (flushing || paused) return
  flushing = true
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.locks?.request === 'function') {
      // Web Locks: exclusion mutua entre pestanas sin depender de timers del
      // event loop. El lock se mantiene mientras el callback este pendiente
      // aunque la pestana se congele; se libera al completar o destruirse.
      await navigator.locks.request('gymtrack-sync', async () => {
        if (paused) return
        await flushInner()
      })
    } else {
      await flushLocalStorageLocked()
    }
  } finally {
    flushing = false
    if (!paused && loadQueue().length > 0 && flushTimer === null) scheduleFlush(0)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === QUEUE_KEY) {
      queue = loadQueue()
      notify()
      scheduleFlush(0)
    } else if (e.key === PAUSE_KEY) {
      paused = loadPaused()
      notify()
    }
  })
  supabase.auth.getSession().then(({ data }) => {
    currentUserId = data.session?.user.id ?? null
  })
  supabase.auth.onAuthStateChange((_event, session) => {
    currentUserId = session?.user.id ?? null
    setPaused(!session)
  })
  window.addEventListener('online', () => scheduleFlush(0))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleFlush(0)
  })
  if (navigator.onLine) scheduleFlush(0)
}

// ---------- Ejecutores ----------

registerExecutor('session_set_upsert', async (op) => {
  const { error } = await supabase
    .from('session_sets')
    .upsert(op.payload as never, { onConflict: 'id' })
  if (error) throw error
})

registerExecutor('session_set_delete', async (op) => {
  const { id } = op.payload as { id: string }
  const { error } = await supabase.from('session_sets').delete().eq('id', id)
  if (error) throw error
})

registerExecutor('session_finish', async (op) => {
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
  if (error) throw error
})

registerExecutor('body_metric_upsert', async (op) => {
  const { error } = await supabase
    .from('body_metrics')
    .upsert(op.payload as never, { onConflict: 'user_id,date' })
  if (error) throw error
})

registerExecutor('routine_exercise_remove', async (op) => {
  const { id } = op.payload as { id: string }
  const { error } = await supabase.from('routine_exercises').delete().eq('id', id)
  if (error) throw error
})