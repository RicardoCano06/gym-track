import { createClient } from '@supabase/supabase-js'
import {
  ANON,
  URL,
  cleanupE2E,
  closeStrayPages,
  login,
  openPage,
  sleep,
} from './e2e-lib.mjs'

const NAME = 'E2E Edge ' + Date.now()

async function seed() {
  const client = createClient(URL, ANON)
  const { data: auth } = await client.auth.signInWithPassword({
    email: 'gymtrack.test.2026@gmail.com',
    password: 'test123456',
  })
  const uid = auth.user.id
  const { data: ex } = await client.from('exercises').select('id').limit(1)
  const exerciseId = ex?.[0]?.id
  if (!exerciseId) throw new Error('catalog sin ejercicios')
  const { data: routine, error: rerr } = await client
    .from('routines')
    .insert({ user_id: uid, name: NAME })
    .select()
    .single()
  if (rerr) throw rerr
  const { data: day, error: derr } = await client
    .from('routine_days')
    .insert({ routine_id: routine.id, day_number: 1, name: 'Día Edge' })
    .select()
    .single()
  if (derr) throw derr
  const { data: re, error: ierr } = await client
    .from('routine_exercises')
    .insert({
      day_id: day.id,
      exercise_id: exerciseId,
      position: 1,
      sets: 1,
      reps: '8-12',
      rest_seconds: 60,
    })
    .select()
    .single()
  if (ierr) throw ierr
  return { reId: re.id, uid }
}

const readQueue = `JSON.parse(localStorage.getItem('gymtrack-pending-queue') || '[]')`
const readPaused = `localStorage.getItem('gymtrack-sync-paused')`
const injectOp = (op) => `(() => {
  const q = JSON.parse(localStorage.getItem('gymtrack-pending-queue') || '[]')
  localStorage.setItem('gymtrack-pending-queue', JSON.stringify([...q, ${JSON.stringify(op)}]))
  return ${JSON.stringify(op.id)}
})()`
const triggerFlush = `(() => { window.dispatchEvent(new Event('online')); document.dispatchEvent(new Event('visibilitychange')) })()`

const run = async () => {
  await closeStrayPages()
  console.log('BEFORE_ALL:', JSON.stringify(await cleanupE2E()))
  const seedData = await seed()
  console.log('SEED_RE:', seedData.reId)

  const page = await openPage()
  console.log('LOGGED_IN:', await login(page))

  await page.eval(`(() => { [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Salir')?.click() })()`)
  await sleep(1500)
  console.log('PAUSED_AFTER_LOGOUT:', await page.eval(readPaused))

  const foreignOp = {
    id: crypto.randomUUID(),
    kind: 'routine_exercise_remove',
    payload: { id: seedData.reId },
    retries: 0,
    createdAt: new Date().toISOString(),
    availableAt: Date.now() - 1000,
    userId: 'foreign-user-123',
  }
  await page.eval(injectOp(foreignOp))
  await page.eval(triggerFlush)
  await sleep(2500)
  const qWhilePaused = await page.eval(readQueue)
  console.log('FOREIGN_QUEUE_WHILE_PAUSED:', JSON.stringify(qWhilePaused.map((o) => [o.kind, o.userId])))

  const client = createClient(URL, ANON)
  await client.auth.signInWithPassword({ email: 'gymtrack.test.2026@gmail.com', password: 'test123456' })
  const { data: reWhilePaused } = await client.from('routine_exercises').select('id').eq('id', seedData.reId)
  console.log('RE_INTACT_WHILE_PAUSED:', (reWhilePaused ?? []).length > 0)

  console.log('LOGGED_IN_AGAIN:', await login(page))
  await sleep(3000)
  const pausedAfterLogin = await page.eval(readPaused)
  const qAfterLogin = await page.eval(readQueue)
  console.log('PAUSED_AFTER_LOGIN:', pausedAfterLogin)
  console.log('QUEUE_AFTER_LOGIN_FOREIGN_DISCARDED:', JSON.stringify(qAfterLogin.map((o) => o.kind)))
  const { data: reAfterForeign } = await client.from('routine_exercises').select('id').eq('id', seedData.reId)
  console.log('RE_INTACT_AFTER_FOREIGN_DISCARDED:', (reAfterForeign ?? []).length > 0)

  const ownOp = {
    id: crypto.randomUUID(),
    kind: 'routine_exercise_remove',
    payload: { id: seedData.reId },
    retries: 0,
    createdAt: new Date().toISOString(),
    availableAt: Date.now() - 1000,
    userId: seedData.uid,
  }
  await page.eval(injectOp(ownOp))
  await page.eval(triggerFlush)
  await sleep(3000)
  const qAfterOwn = await page.eval(readQueue)
  console.log('QUEUE_AFTER_OWN_FLUSH:', JSON.stringify(qAfterOwn.map((o) => o.kind)))
  const { data: reAfterOwn } = await client.from('routine_exercises').select('id').eq('id', seedData.reId)
  console.log('RE_DELETED_AFTER_OWN_FLUSH:', (reAfterOwn ?? []).length === 0)

  page.close()
  console.log('AFTER_ALL:', JSON.stringify(await cleanupE2E()))
  process.exit(0)
}
run().catch(async (e) => {
  console.error('ERR', e.message)
  try {
    console.log('AFTER_ALL:', JSON.stringify(await cleanupE2E()))
  } catch {}
  process.exit(1)
})