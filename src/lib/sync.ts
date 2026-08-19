import { supabase } from '@/lib/supabase'

export interface PendingOp {
  id: string
  kind: string
  payload: Record<string, unknown>
  retries: number
  createdAt: string
  availableAt?: number
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
const LOCK_TTL = 8000
const MAX_BACKOFF = 15000

let queue: PendingOp[] = loadQueue()
let flushTimer: number | null = null
let flushing = false
let hasLock = false

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

function acquireLock(): boolean {
  try {
    const now = Date.now()
    const raw = localStorage.getItem(LOCK_KEY)
    if (raw) {
      const lock = JSON.parse(raw) as { until: number }
      if (lock.until > now) return false
    }
    const until = now + LOCK_TTL
    localStorage.setItem(LOCK_KEY, JSON.stringify({ until }))
    const check = JSON.parse(localStorage.getItem(LOCK_KEY) ?? 'null')
    if (check?.until !== until) return false
    hasLock = true
    return true
  } catch {
    return true
  }
}

function releaseLock() {
  if (!hasLock) return
  hasLock = false
  try {
    localStorage.removeItem(LOCK_KEY)
  } catch {
    // sin almacenamiento: no hay lock que liberar
  }
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
  if (flushing || flushTimer !== null) return
  const delay = Math.max(0, at - Date.now())
  flushTimer = window.setTimeout(() => {
    flushTimer = null
    void flush()
  }, delay)
}

async function flush() {
  if (flushing) return
  if (!acquireLock()) {
    scheduleFlush(200)
    return
  }
  flushing = true
  try {
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
      const executor = executors.get(op.kind)
      if (!executor) continue
      try {
        await executor(op)
        saveQueue(loadQueue().filter((q) => q.id !== op.id))
        notify()
      } catch {
        op.retries += 1
        saveQueue(loadQueue().map((q) => (q.id === op.id ? op : q)))
        notify()
        scheduleFlush(Math.min(MAX_BACKOFF, 1000 * 2 ** Math.min(op.retries, 4)))
        return
      }
    }
  } finally {
    flushing = false
    releaseLock()
    if (loadQueue().length > 0 && flushTimer === null) scheduleFlush(0)
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === QUEUE_KEY) {
      queue = loadQueue()
      notify()
      scheduleFlush(0)
    }
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