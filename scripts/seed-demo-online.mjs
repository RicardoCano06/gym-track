// Seed del Demo Sandbox ONLINE (180 días para demo@vekt.app).
//
// Replica supabase/seed.sql vía REST (service role). Idempotente: borra y
// regenera los datos del demo. No requiere SQL editor.
// Uso: node scripts/seed-demo-online.mjs
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

function readEnv() {
  const raw = readFileSync(path.join(ROOT, '.env.local'), 'utf8')
  const m = {}
  for (const line of raw.split(/\r?\n/)) {
    const i = line.indexOf('=')
    if (i > 0) m[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return m
}

const env = readEnv()
const url = env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Faltan VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en .env.local')
  process.exit(1)
}
const sb = createClient(url, key)

// ---------- RNG determinista ----------
let seed = 0x564b5454
function rng() {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const round = (v, step = 0.5) => Math.round(v / step) * step

// ---------- catálogo (lookup por nombre) ----------
const SPECS = [
  ['Press de banca agarre medio', 60, 85],
  ['Press inclinado con mancuernas', 24, 34],
  ['Press militar con barra', 35, 50],
  ['Remo con barra', 55, 72.5],
  ['Jalón al pecho agarre cerrado', 50, 67.5],
  ['Curl con barra', 20, 30],
  ['Sentadilla con barra', 70, 100],
  ['Peso muerto', 80, 120],
  ['Prensa de piernas', 140, 210],
  ['Zancadas con mancuernas', 14, 22],
  ['Prensa de gemelos', 90, 130],
  ['Rueda abdominal', 10, 15],
]

const DAYS = [
  { routine: 'Torso', day: 1, name: 'Torso A', weekday: 'lunes', goal: 'Empuje y tirón horizontal', exercises: [['Press de banca agarre medio', 3, 90], ['Remo con barra', 3, 90], ['Press militar con barra', 3, 90], ['Rueda abdominal', 3, 60]] },
  { routine: 'Pierna', day: 1, name: 'Pierna A', weekday: 'martes', goal: 'Sentadilla y bisagra', exercises: [['Sentadilla con barra', 4, 180], ['Peso muerto', 4, 180], ['Prensa de gemelos', 3, 60]] },
  { routine: 'Torso', day: 2, name: 'Torso B', weekday: 'jueves', goal: 'Empuje y tirón vertical', exercises: [['Press inclinado con mancuernas', 3, 90], ['Jalón al pecho agarre cerrado', 3, 90], ['Curl con barra', 3, 90], ['Press militar con barra', 3, 90]] },
  { routine: 'Pierna', day: 2, name: 'Pierna B', weekday: 'viernes', goal: 'Prensa y zancada', exercises: [['Prensa de piernas', 3, 120], ['Zancadas con mancuernas', 3, 90], ['Prensa de gemelos', 3, 60], ['Rueda abdominal', 3, 60]] },
]

const WEEKDAY = { domingo: 0, lunes: 1, martes: 2, miércoles: 3, jueves: 4, viernes: 5, sábado: 6 }
const TOTAL_DAYS = 180

async function main() {
  const { data: users } = await sb.auth.admin.listUsers()
  const demo = (users?.users ?? []).find((u) => u.email === 'demo@vekt.app')
  if (!demo) {
    console.error('No existe demo@vekt.app. Creala primero.')
    process.exit(1)
  }
  const uid = demo.id

  // resolver ids reales del catálogo
  const { data: exercises } = await sb.from('exercises').select('id, name')
  const byName = new Map((exercises ?? []).map((e) => [e.name, e.id]))
  const exId = (name) => {
    const id = byName.get(name)
    if (!id) console.warn('  ! ejercicio no encontrado:', name)
    return id
  }
  const specByKey = new Map(SPECS.map(([name, start, end]) => [name, { start, end }]))

  // ---------- limpieza ----------
  const { data: oldSessions } = await sb.from('sessions').select('id').eq('user_id', uid)
  for (const s of oldSessions ?? []) {
    await sb.from('session_sets').delete().eq('session_id', s.id)
  }
  await sb.from('sessions').delete().eq('user_id', uid)
  const { data: oldRoutines } = await sb.from('routines').select('id').eq('user_id', uid)
  for (const r of oldRoutines ?? []) {
    const { data: days } = await sb.from('routine_days').select('id').eq('routine_id', r.id)
    for (const d of days ?? []) await sb.from('routine_exercises').delete().eq('day_id', d.id)
    await sb.from('routine_days').delete().eq('routine_id', r.id)
  }
  await sb.from('routines').delete().eq('user_id', uid)
  await sb.from('body_metrics').delete().eq('user_id', uid)

  // ---------- rutinas y días ----------
  const start = new Date(Date.now() - (TOTAL_DAYS - 1) * 86400000)
  start.setHours(12, 0, 0, 0)
  const routineId = new Map()
  for (const name of ['Torso', 'Pierna']) {
    const { data } = await sb
      .from('routines')
      .insert({ user_id: uid, name, description: '', created_at: start.toISOString() })
      .select('id')
      .single()
    routineId.set(name, data.id)
  }
  const dayIdBySpec = new Map()
  const reRows = []
  for (const spec of DAYS) {
    const { data } = await sb
      .from('routine_days')
      .insert({
        routine_id: routineId.get(spec.routine),
        day_number: spec.day,
        name: spec.name,
        weekday: spec.weekday,
        goal: spec.goal,
      })
      .select('id')
      .single()
    dayIdBySpec.set(spec, data.id)
    spec.exercises.forEach(([name, sets, rest], i) => {
      const id = exId(name)
      if (id) reRows.push({ day_id: data.id, exercise_id: id, position: i, sets, reps: '8-12', rest_seconds: rest, superset_group: null, notes: '' })
    })
  }
  for (let i = 0; i < reRows.length; i += 100) {
    const { error } = await sb.from('routine_exercises').insert(reRows.slice(i, i + 100))
    if (error) throw error
  }
  console.log('rutinas/días/ejercicios listos')

  // ---------- sesiones y series ----------
  const sessionCount = new Map()
  let sessions = 0
  let sets = 0
  for (let offset = TOTAL_DAYS - 1; offset >= 0; offset--) {
    const day = new Date(start.getTime() + offset * 86400000)
    const spec = DAYS.find((d) => WEEKDAY[d.weekday] === day.getDay())
    if (!spec) continue

    const started = new Date(day)
    started.setHours(18, 30, 0, 0)
    const duration = 55 + Math.floor(rng() * 11)
    const ended = new Date(started.getTime() + duration * 60000)
    const { data: session } = await sb
      .from('sessions')
      .insert({
        user_id: uid,
        routine_id: routineId.get(spec.routine),
        day_id: dayIdBySpec.get(spec),
        started_at: started.toISOString(),
        ended_at: ended.toISOString(),
        duration_minutes: duration,
        feeling: 3 + Math.floor(rng() * 3),
        notes: '',
      })
      .select('id')
      .single()
    sessions++

    const inDeload = offset % 42 < 7
    for (const [name, setsCount] of spec.exercises.map(([n, s]) => [n, s])) {
      const id = exId(name)
      if (!id) continue
      const { start: s0, end: e0 } = specByKey.get(name)
      const idx = sessionCount.get(name) ?? 0
      sessionCount.set(name, idx + 1)
      const progress = Math.min(1, idx / 26)
      const base = s0 + (e0 - s0) * progress
      const dayWeight = round((inDeload ? base * 0.8 : base) + (rng() * 2 - 1) * 2.5)

      const rows = []
      for (let i = 1; i <= setsCount; i++) {
        const scale = [0.96, 1.0, 1.04][i - 1] ?? 1.0
        rows.push({
          session_id: session.id,
          exercise_id: id,
          set_number: i,
          weight_kg: round(dayWeight * scale),
          reps: i === 1 ? 10 + Math.floor(rng() * 3) : i === 2 ? 8 + Math.floor(rng() * 3) : 6 + Math.floor(rng() * 3),
          rpe: 7 + Math.floor(rng() * 3),
          completed: true,
          notes: '',
        })
      }
      const { error } = await sb.from('session_sets').insert(rows)
      if (error) throw error
      sets += rows.length
    }
  }
  console.log(`sesiones: ${sessions} | series: ${sets}`)

  // ---------- medidas corporales ----------
  let metrics = 0
  for (let offset = TOTAL_DAYS - 1; offset >= 0; offset -= 7) {
    const day = new Date(start.getTime() + offset * 86400000)
    const progress = 1 - offset / TOTAL_DAYS
    const { error } = await sb.from('body_metrics').insert({
      user_id: uid,
      date: day.toISOString().slice(0, 10),
      weight_kg: round(88 - 5.6 * progress + (rng() * 0.8 - 0.4), 0.1),
      notes: '',
    })
    if (error) throw error
    metrics++
  }
  console.log(`métricas: ${metrics}`)

  // ---------- perfil ----------
  await sb.from('user_profiles').upsert({
    user_id: uid,
    height_cm: 178,
    age: 29,
    sex: 'male',
    level: 'intermedio',
    goal: 'ganar_masa',
    updated_at: new Date().toISOString(),
  })
  console.log('perfil listo')
  console.log('OK: demo online seed completo')
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})