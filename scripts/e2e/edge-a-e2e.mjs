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
  const { data: ex } = await client.from('exercises').select('id').limit(2)
  const exIds = (ex ?? []).map((e) => e.id)
  if (exIds.length < 2) throw new Error('catalog sin ejercicios')
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
  const rows = []
  for (let i = 0; i < 2; i++) {
    const { data: re, error } = await client
      .from('routine_exercises')
      .insert({
        day_id: day.id,
        exercise_id: exIds[i],
        position: i + 1,
        sets: 1,
        reps: '8-12',
        rest_seconds: 60,
      })
      .select()
      .single()
    if (error) throw error
    rows.push(re)
  }
  return { routineId: routine.id, re1: rows[0], re2: rows[1], uid }
}

const removeRow = (exerciseId) =>
  `(() => { const li = [...document.querySelectorAll('li')].find(l => l.querySelector('a[href*="${exerciseId}"]')); if (li) li.querySelector('button[title="Quitar ejercicio"]').click() })()`

const readQueue = (uid) =>
  `JSON.parse(localStorage.getItem('gymtrack-sync-queue-${uid}') || '[]')`

const run = async () => {
  await closeStrayPages()
  console.log('BEFORE_ALL:', JSON.stringify(await cleanupE2E()))
  const seedData = await seed()
  console.log('SEED:', JSON.stringify({ routineId: seedData.routineId, re1: seedData.re1.id, re2: seedData.re2.id }))

  const pageB = await openPage()
  console.log('LOGGED_IN_B:', await login(pageB))
  const pageA = await openPage()
  console.log('LOGGED_IN_A:', await login(pageA))

  await pageA.nav(BASE_URL + '/rutinas/' + seedData.routineId)
  await sleep(2000)
  const rowsA = await pageA.eval(`(() => [...document.querySelectorAll('button')].filter(b=>b.title==='Quitar ejercicio').length)()`)
  console.log('ROWS_IN_A:', rowsA)

  await pageA.eval(removeRow(seedData.re1.exercise_id))
  await sleep(400)
  const qA1 = await pageA.eval(readQueue(seedData.uid))
  const qB1 = await pageB.eval(readQueue(seedData.uid))
  console.log('QUEUE_A_AFTER_REMOVE:', JSON.stringify(qA1.map((o) => ({ kind: o.kind, id: o.payload?.id, availableAt: o.availableAt }))))
  console.log('QUEUE_B_AFTER_REMOVE:', JSON.stringify(qB1.map((o) => ({ kind: o.kind, id: o.payload?.id }))))
  const crossTabSeen = qB1.some((o) => o.kind === 'routine_exercise_remove' && o.payload?.id === seedData.re1.id)
  console.log('CROSS_TAB_VISIBLE_IN_B:', crossTabSeen)

  await pageA.eval(`(() => { [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Deshacer')?.click() })()`)
  await sleep(500)
  const qA2 = await pageA.eval(readQueue(seedData.uid))
  const qB2 = await pageB.eval(readQueue(seedData.uid))
  console.log('QUEUE_A_AFTER_UNDO:', JSON.stringify(qA2.map((o) => o.kind)))
  console.log('QUEUE_B_AFTER_UNDO:', JSON.stringify(qB2.map((o) => o.kind)))

  await sleep(5000)
  const client = createClient(URL, ANON)
  await client.auth.signInWithPassword({ email: 'gymtrack.test.2026@gmail.com', password: 'test123456' })
  const { data: re1Check } = await client.from('routine_exercises').select('id').eq('id', seedData.re1.id)
  console.log('UNDO_WON_RE1_INTACT:', (re1Check ?? []).length > 0)

  await pageA.eval(removeRow(seedData.re2.exercise_id))
  await sleep(400)
  const qA3 = await pageA.eval(readQueue(seedData.uid))
  console.log('QUEUE_A_AFTER_REMOVE2:', JSON.stringify(qA3.map((o) => ({ kind: o.kind, id: o.payload?.id, availableAt: o.availableAt }))))
  await pageA.closeTab()

  await sleep(5500)
  const { data: re2Check } = await client.from('routine_exercises').select('id').eq('id', seedData.re2.id)
  console.log('REMOVE2_EXECUTED_BY_B:', (re2Check ?? []).length === 0)

  pageB.close()
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