import { supabase } from '@/lib/supabase'

export interface PendingOp {
  id: string
  kind: string
  payload: Record<string, unknown>
  retries: number
  createdAt: string
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
const MAX_BACKOFF = 15000

let queue: PendingOp[] = loadQueue()
let flushTimer: number | null = null
let flushing = false

const listeners = new Set<() => void>()
const executors = new Map<string, (op: PendingOp) => Promise<void>>()

function loadQueue(): PendingOp[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as PendingOp[]
  } catch {
    return []
  }
}

function persistQueue() {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // almacenamiento no disponible: la cola vive solo en memoria
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
  queue = [...queue, op]
  persistQueue()
  notify()
  scheduleFlush(0)
}

export function dequeue(predicate: (op: PendingOp) => boolean) {
  const before = queue.length
  queue = queue.filter((op) => !predicate(op))
  if (queue.length !== before) {
    persistQueue()
    notify()
  }
}

function scheduleFlush(delayMs: number) {
  if (flushing || flushTimer !== null) return
  flushTimer = window.setTimeout(() => {
    flushTimer = null
    void flush()
  }, delayMs)
}

async function flush() {
  if (flushing || queue.length === 0) return
  flushing = true
  try {
    for (const op of queue) {
      const executor = executors.get(op.kind)
      if (!executor) continue
      try {
        await executor(op)
        queue = queue.filter((q) => q.id !== op.id)
        persistQueue()
        notify()
      } catch {
        op.retries += 1
        persistQueue()
        notify()
        scheduleFlush(Math.min(MAX_BACKOFF, 1000 * 2 ** Math.min(op.retries, 4)))
        return
      }
    }
  } finally {
    flushing = false
    if (queue.length > 0 && flushTimer === null) scheduleFlush(0)
  }
}

if (typeof window !== 'undefined') {
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