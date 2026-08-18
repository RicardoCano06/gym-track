// Sube supabase/seed-data.json a la base de datos (requiere SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
// Uso: npm run seed:db
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA = path.join(__dirname, '..', 'supabase', 'seed-data.json')

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (ver .env.local / .env.example)')
  process.exit(1)
}

const supabase = createClient(url, key)

async function upsertMuscles(rows) {
  const { data, error } = await supabase
    .from('muscles')
    .upsert(rows, { onConflict: 'name', ignoreDuplicates: false })
    .select('id, name')
  if (error) throw error
  return new Map(data.map((m) => [m.name, m.id]))
}

async function upsertEquipment(rows) {
  const { data, error } = await supabase
    .from('equipment')
    .upsert(rows, { onConflict: 'name', ignoreDuplicates: false })
    .select('id, name')
  if (error) throw error
  return new Map(data.map((e) => [e.name, e.id]))
}

async function main() {
  const seed = JSON.parse(await readFile(DATA, 'utf8'))
  console.log(`Seed: ${seed.muscles.length} músculos, ${seed.equipment.length} equipos, ${seed.exercises.length} ejercicios`)

  const muscleIds = await upsertMuscles(seed.muscles)
  const equipmentIds = await upsertEquipment(seed.equipment)
  console.log('Músculos y equipos sincronizados')

  const rows = seed.exercises.map((ex) => ({
    source_id: ex.source_id,
    name: ex.name,
    name_en: ex.name_en,
    instructions: ex.instructions,
    muscle_primary: muscleIds.get(ex.muscle_primary) ?? null,
    muscle_secondary: (ex.muscle_secondary ?? []).map((n) => muscleIds.get(n)).filter(Boolean),
    equipment: equipmentIds.get(ex.equipment) ?? null,
    category: ex.category,
    level: ex.level,
    force: ex.force,
    image_url: ex.image_url,
  }))

  const BATCH = 100
  let ok = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await supabase.from('exercises').upsert(batch, { onConflict: 'source_id' })
    if (error) throw error
    ok += batch.length
    console.log(`  ${ok}/${rows.length} ejercicios...`)
  }

  console.log(`OK: catálogo completo en la base de datos (${ok} ejercicios)`)
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})