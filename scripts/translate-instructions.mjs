// Traduce al español las instrucciones de supabase/seed-data.json (endpoint gtx).
// Uso: node scripts/translate-instructions.mjs
// - Mantiene un caché en supabase/.instructions-cache.json (no volver a traducir lo ya hecho).
// - Escribe instructions_es en cada ejercicio de seed-data.json, preservando el orden.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA = path.join(__dirname, '..', 'supabase', 'seed-data.json')
const CACHE = path.join(__dirname, '..', 'supabase', '.instructions-cache.json')

const CONCURRENCY = 8
const RETRIES = 4
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

async function translateOne(text) {
  const url =
    'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=es&dt=t&q=' +
    encodeURIComponent(text)
  const res = await fetch(url, { headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  if (!Array.isArray(data) || !Array.isArray(data[0])) throw new Error('respuesta inesperada')
  return data[0].map((seg) => seg[0]).join('')
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function translateBatch(texts) {
  const cache = JSON.parse(await readFile(CACHE, 'utf8').catch(() => '{}'))
  const pending = texts.filter((t) => !cache[t])
  console.log(`Caché: ${texts.length - pending.length}/${texts.length} ya traducidas`)
  if (pending.length === 0) return cache

  let done = 0
  const queue = [...pending]
  async function worker() {
    while (queue.length) {
      const text = queue.shift()
      for (let attempt = 1; attempt <= RETRIES; attempt++) {
        try {
          const es = await translateOne(text)
          cache[text] = es
          done++
          if (done % 50 === 0 || done === pending.length) {
            await writeFile(CACHE, JSON.stringify(cache, null, 1))
            console.log(`  ${done}/${pending.length} traducidas...`)
          }
          break
        } catch (err) {
          if (attempt === RETRIES) {
            console.error(`  ERROR: no se pudo traducir "${text.slice(0, 60)}": ${err.message}`)
          } else {
            await sleep(400 * attempt)
          }
        }
      }
      await sleep(80)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  await writeFile(CACHE, JSON.stringify(cache, null, 1))
  return cache
}

async function main() {
  const seed = JSON.parse(await readFile(DATA, 'utf8'))
  const unique = new Set()
  for (const ex of seed.exercises) for (const i of ex.instructions ?? []) unique.add(i)
  const texts = [...unique]

  console.log(`Instrucciones únicas: ${texts.length}`)
  const cache = await translateBatch(texts)

  let withEs = 0
  let steps = 0
  for (const ex of seed.exercises) {
    const es = (ex.instructions ?? []).map((i) => cache[i]).filter(Boolean)
    if (es.length) {
      ex.instructions_es = es
      withEs++
      steps += es.length
    } else {
      delete ex.instructions_es
    }
  }
  await writeFile(DATA, JSON.stringify(seed, null, 2) + '\n')
  console.log(`OK: ${withEs}/${seed.exercises.length} ejercicios con instructions_es (${steps} pasos)`)
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})