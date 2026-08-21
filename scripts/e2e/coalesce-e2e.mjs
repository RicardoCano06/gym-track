import { createClient } from '@supabase/supabase-js'
import {
  ANON,
  TEST_EMAIL,
  TEST_PASS,
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
    email: TEST_EMAIL,
    password: TEST_PASS,
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
  return { uid, dayId: day.id, exerciseId }
}

const typeWeight = (value) =>
  `(() => { const inp = document.querySelector('input[placeholder="Peso"]'); if (!inp) return false; const s = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set; s.call(inp, ${JSON.stringify(String(value))}); inp.dispatchEvent(new Event('input', { bubbles: true })); return true })()`
const readQueue = (uid) =>
  `JSON.parse(localStorage.getItem('gymtrack-sync-queue-${uid}') || '[]')`
const offline = { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }
const online = { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }

const run = async () => {
  await closeStrayPages()
  console.log('BEFORE_ALL:', JSON.stringify(await cleanupE2E()))
  const seedData = await seed()
  console.log('SEED_DAY:', seedData.dayId)

  const page = await openPage()
  console.log('LOGGED_IN:', await login(page))
  await page.nav(BASE_URL + '/entrenar/' + seedData.dayId)
  await sleep(3000)
  const loaded = await page.eval(`(() => !!document.querySelector('input[placeholder="Peso"]'))()`)
  console.log('TRAIN_LOADED:', loaded)

  await page.send('Network.enable')
  await page.send('Network.emulateNetworkConditions', offline)

  await page.eval(typeWeight(42))
  await sleep(2500)
  let q = await page.eval(readQueue(seedData.uid))
  console.log('QUEUE_WITH_UPSERT:', JSON.stringify(q.map((o) => ({ kind: o.kind, id: o.payload?.id }))))
  const setRowId = q.find((o) => o.kind === 'session_set_upsert')?.payload?.id
  console.log('SET_ROW_ID:', setRowId)

  await page.eval(`(() => { [...document.querySelectorAll('button')].find(b=>b.title==='Eliminar serie')?.click() })()`)
  await sleep(400)
  await page.eval(`(() => { [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Eliminar')?.click() })()`)
  await sleep(1000)
  const q2 = await page.eval(readQueue(seedData.uid))
  console.log('QUEUE_AFTER_DELETE_COALESCED:', JSON.stringify(q2.map((o) => ({ kind: o.kind, id: o.payload?.id }))))

  await page.send('Network.emulateNetworkConditions', online)
  await sleep(5000)
  const client = createClient(URL, ANON)
  await client.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASS })
  const { data: row } = await client.from('session_sets').select('id').eq('id', setRowId)
  console.log('SET_NEVER_SYNCED:', setRowId !== undefined && (row ?? []).length === 0)

  // Fase B: par ordenado [upsert, delete] para la misma serie — la forma exacta
  // que adopta la cola cuando el delete llega con el upsert in-flight. El delete
  // debe ejecutarse DESPUES del upsert (aunque el upsert cree la fila) y dejar
  // la base sin rastro: sin "resurreccion".
  const { data: session, error: serr } = await client
    .from('sessions')
    .insert({ user_id: seedData.uid, day_id: seedData.dayId })
    .select('id')
    .single()
  if (serr) throw serr
  const ghostId = '11111111-1111-4111-8111-111111111111'
  const inject = `(() => {
    const now = Date.now()
    const op = (kind, payload) => ({
      id: 'op-' + Math.random().toString(36).slice(2),
      kind,
      payload,
      retries: 0,
      createdAt: new Date(now).toISOString(),
      availableAt: now - 1000,
      userId: '${seedData.uid}',
    })
    const upsert = op('session_set_upsert', {
      id: '${ghostId}',
      session_id: '${session.id}',
      exercise_id: '${seedData.exerciseId}',
      set_number: 1,
      weight_kg: 60,
      completed: true,
    })
    const del = op('session_set_delete', { id: '${ghostId}' })
    localStorage.setItem('gymtrack-sync-queue-${seedData.uid}', JSON.stringify([upsert, del]))
    window.dispatchEvent(new Event('online'))
    return true
  })()`
  await page.eval(inject)
  await sleep(6000)
  const q3 = await page.eval(readQueue(seedData.uid))
  console.log('QUEUE_AFTER_ORDERED_PAIR:', JSON.stringify(q3.map((o) => ({ kind: o.kind, id: o.payload?.id }))))
  const { data: ghost } = await client.from('session_sets').select('id').eq('id', ghostId)
  console.log('ORDERED_PAIR_NO_RESURRECT:', (ghost ?? []).length === 0)

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