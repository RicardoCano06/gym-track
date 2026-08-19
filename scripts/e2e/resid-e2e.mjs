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

const DAY_ID = '7bf1fe59-829d-469c-b095-ddec0f02ec33'
const ROUTINE_ID = 'b76fd0e4-e431-4b7d-bd71-9382db91f1a4'

const run = async () => {
  await closeStrayPages()
  const page = await openPage()
  console.log('BEFORE_ALL:', JSON.stringify(await cleanupE2E()))
  console.log('LOGGED_IN:', await login(page))

  await page.nav(BASE_URL + '/rutinas/' + ROUTINE_ID)
  await sleep(2500)
  const rows = await page.eval(`(() => [...document.querySelectorAll('button')].filter(b=>b.title==='Quitar ejercicio').length)()`)
  console.log('ROWS_BEFORE:', rows)

  await page.eval(`(() => { [...document.querySelectorAll('button')].find(b=>b.title==='Quitar ejercicio')?.click() })()`)
  await sleep(400)
  const q = await page.eval(`JSON.parse(localStorage.getItem('gymtrack-pending-queue')||'[]')`)
  console.log('QUEUE_AFTER_REMOVE:', JSON.stringify(q.map(o=>({ kind: o.kind, id: o.payload?.id, availableAt: o.availableAt, now: Date.now() }))))
  const undoOk = q.some(o => o.kind === 'routine_exercise_remove' && o.availableAt && o.availableAt > Date.now() + 3000)
  console.log('UNDO_QUEUE_OK:', undoOk)

  await page.eval(`(() => { [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Deshacer')?.click() })()`)
  await sleep(500)
  const q2 = await page.eval(`JSON.parse(localStorage.getItem('gymtrack-pending-queue')||'[]')`)
  console.log('QUEUE_AFTER_UNDO:', JSON.stringify(q2.map(o=>o.kind)))
  const rows2 = await page.eval(`(() => [...document.querySelectorAll('button')].filter(b=>b.title==='Quitar ejercicio').length)()`)
  console.log('ROWS_AFTER_UNDO:', rows2)

  await page.nav(BASE_URL + '/entrenar/' + DAY_ID)
  await sleep(3000)
  const typed = await page.eval(`(() => { const inp=document.querySelector('input[placeholder="Peso"]'); if(!inp) return false; const s=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; s.call(inp,'55'); inp.dispatchEvent(new Event('input',{bubbles:true})); return true })()`)
  console.log('TYPED_WEIGHT:', typed)
  await page.eval(`(() => { [...document.querySelectorAll('button')].find(b=>b.textContent.includes('Finalizar entrenamiento'))?.click() })()`)
  await sleep(150)
  await page.eval(`(() => { [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Terminar sin sensación')?.click() })()`)
  await sleep(3000)

  const client = createClient(URL, ANON)
  const { data: auth } = await client.auth.signInWithPassword({ email: 'gymtrack.test.2026@gmail.com', password: 'test123456' })
  const uid = auth.user?.id
  const { data: sess } = await client.from('sessions').select('id, ended_at').eq('user_id', uid).eq('day_id', DAY_ID).not('ended_at','is',null).order('ended_at',{ascending:false}).limit(1)
  const sid = sess?.[0]?.id
  const { data: sets } = sid ? await client.from('session_sets').select('weight_kg, reps').eq('session_id', sid) : { data: null }
  console.log('FLUSH_DB:', JSON.stringify({ session: sid, ended_at: sess?.[0]?.ended_at, sets }))

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