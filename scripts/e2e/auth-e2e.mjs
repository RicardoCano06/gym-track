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

const makeOp = (id, payload, userId) => ({
  id,
  kind: 'routine_exercise_remove',
  payload,
  retries: 0,
  createdAt: new Date().toISOString(),
  availableAt: Date.now() - 1000,
  userId,
})
const injectInto = (key, op) =>
  `localStorage.setItem('${key}', JSON.stringify([${JSON.stringify(op)}]))`
const triggerFlush = `(() => { window.dispatchEvent(new Event('online')); document.dispatchEvent(new Event('visibilitychange')) })()`
const readRaw = (key) => `localStorage.getItem('${key}')`

const run = async () => {
  await closeStrayPages()
  console.log('BEFORE_ALL:', JSON.stringify(await cleanupE2E()))
  const seedData = await seed()
  console.log('SEED_RE:', seedData.reId)

  const page = await openPage()
  console.log('LOGGED_IN:', await login(page))

  const foreignUser = 'foreign-user-123'
  const foreignKey = `gymtrack-sync-queue-${foreignUser}`
  const foreignOp = makeOp(crypto.randomUUID(), { id: seedData.reId }, foreignUser)
  await page.eval(injectInto(foreignKey, foreignOp))
  await page.eval(triggerFlush)
  await sleep(3000)

  const client = createClient(URL, ANON)
  await client.auth.signInWithPassword({ email: 'gymtrack.test.2026@gmail.com', password: 'test123456' })
  const { data: reAfterForeign } = await client.from('routine_exercises').select('id').eq('id', seedData.reId)
  console.log('RE_INTACT_AFTER_FOREIGN_FLUSH:', (reAfterForeign ?? []).length > 0)
  const foreignRaw = await page.eval(readRaw(foreignKey))
  const foreignParsed = JSON.parse(foreignRaw || 'null')
  console.log('FOREIGN_QUEUE_PRESERVED:', foreignParsed !== null && foreignParsed.length === 1 && foreignParsed[0].id === foreignOp.id && foreignParsed[0].userId === foreignUser)

  const ownKey = `gymtrack-sync-queue-${seedData.uid}`
  const ownOp = makeOp(crypto.randomUUID(), { id: seedData.reId }, seedData.uid)
  await page.eval(injectInto(ownKey, ownOp))
  await page.eval(triggerFlush)
  await sleep(3000)
  const ownRaw = await page.eval(readRaw(ownKey))
  console.log('OWN_QUEUE_DRAINED:', JSON.parse(ownRaw || '[]').length === 0)
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