import { createClient } from '@supabase/supabase-js'
import {
  ANON,
  BASE_URL,
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
  const { error: ierr } = await client.from('routine_exercises').insert({
    day_id: day.id,
    exercise_id: exerciseId,
    position: 1,
    sets: 1,
    reps: '8-12',
    rest_seconds: 60,
  })
  if (ierr) throw ierr
  return { dayId: day.id }
}

async function weightsForDay(uid, dayId) {
  const client = createClient(URL, ANON)
  await client.auth.signInWithPassword({ email: 'gymtrack.test.2026@gmail.com', password: 'test123456' })
  const { data: sessions } = await client
    .from('sessions')
    .select('id')
    .eq('user_id', uid)
    .eq('day_id', dayId)
  const ids = (sessions ?? []).map((s) => s.id)
  if (ids.length === 0) return []
  const { data } = await client.from('session_sets').select('weight_kg').in('session_id', ids)
  return (data ?? []).map((s) => s.weight_kg)
}

const typeWeight = (value) =>
  `(() => { const inp = document.querySelector('input[placeholder="Peso"]'); if (!inp) return false; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(inp, ${JSON.stringify(String(value))}); inp.dispatchEvent(new Event('input', { bubbles: true })); return true })()`

const forceHiddenAndRead = `(() => {
  Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
  return JSON.parse(localStorage.getItem('gymtrack-pending-queue') || '[]')
})()`

const readQueue = `JSON.parse(localStorage.getItem('gymtrack-pending-queue') || '[]')`

const run = async () => {
  await closeStrayPages()
  console.log('BEFORE_ALL:', JSON.stringify(await cleanupE2E()))
  const seedData = await seed()
  console.log('SEED_DAY:', seedData.dayId)

  const pageA = await openPage()
  console.log('LOGGED_IN_A:', await login(pageA))
  await pageA.nav(BASE_URL + '/entrenar/' + seedData.dayId)
  await sleep(3000)
  const sessionVisible = await pageA.eval(`(() => !!document.querySelector('input[placeholder="Peso"]'))()`)
  console.log('TRAIN_LOADED:', sessionVisible)

  await pageA.eval(typeWeight(42))
  const qSync = await pageA.eval(forceHiddenAndRead)
  console.log('QUEUE_AFTER_FORCED_HIDDEN:', JSON.stringify(qSync.map((o) => ({ kind: o.kind, weight: o.payload?.weight_kg }))))

  await pageA.eval(`(() => { Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')) })()`)
  await sleep(2500)
  const qAfterVisible = await pageA.eval(readQueue)
  console.log('QUEUE_AFTER_VISIBLE:', JSON.stringify(qAfterVisible.map((o) => ({ kind: o.kind, retries: o.retries, weight: o.payload?.weight_kg }))))
  const client = createClient(URL, ANON)
  const { data: auth } = await client.auth.signInWithPassword({ email: 'gymtrack.test.2026@gmail.com', password: 'test123456' })
  const uid = auth.user.id
  const { data: sessOfDay } = await client.from('sessions').select('id, day_id').eq('user_id', uid).eq('day_id', seedData.dayId)
  console.log('SESSIONS_OF_DAY:', JSON.stringify(sessOfDay))
  const w1 = await weightsForDay(uid, seedData.dayId)
  console.log('DB_AFTER_VISIBLE:', JSON.stringify(w1))

  await pageA.eval(typeWeight(55))
  const qBeforeClose = await pageA.eval(forceHiddenAndRead)
  console.log('QUEUE_BEFORE_ABRUPT_CLOSE:', JSON.stringify(qBeforeClose.map((o) => ({ kind: o.kind, weight: o.payload?.weight_kg }))))
  await pageA.closeTab()
  await sleep(1500)

  const pageC = await openPage()
  await login(pageC)
  await sleep(2000)
  const qC = await pageC.eval(readQueue)
  console.log('QUEUE_C_AFTER_ABRUPT_CLOSE:', JSON.stringify(qC.map((o) => ({ kind: o.kind, weight: o.payload?.weight_kg }))))
  await sleep(2500)
  const w2 = await weightsForDay(uid, seedData.dayId)
  console.log('DB_FINAL_AFTER_REOPEN:', JSON.stringify(w2))

  pageC.close()
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