// Naturaliza las instrucciones al español rioplatense:
// 1) OVERRIDES (a mano) para frases recurrentes.
// 2) Normalizador sobre la traducción automática del resto:
//    - voseo consistente (usted/tú -> vos)
//    - glosario de gimnasio (rack, mangos, discos, fallo, etc.)
//    - corrección de calcos típicos del traductor automático
// Uso: node scripts/naturalize-instructions.mjs
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { OVERRIDES } from './instr-overrides.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA = path.join(__dirname, '..', 'supabase', 'seed-data.json')
const CACHE = path.join(__dirname, '..', 'supabase', '.instructions-cache.json')

// ---------- glosario: términos que el traductor automático pega mal ----------
const TERM_FIXES = [
  // equipo / instalaciones
  [/\brejilla(s)?\b/gi, 'soporte'],
  [/\brack\b/gi, 'soporte'],
  [/\bmanijas?\b/gi, (m) => (m.toLowerCase().endsWith('a') ? 'mango' : 'mangos')],
  [/\basas?\b/gi, (m) => (m === 'asa' ? 'mango' : 'mangos')],
  [/\bfracaso\b/gi, 'fallo'],
  [/\bestacionari(os|as)?\b/gi, (m) => (m.endsWith('a') || m.endsWith('as') ? 'quietas' : 'quietos')],
  [/\bmina terrestre\b/gi, 'landmine'],
  [/\btúmbate\b/gi, 'acostate'],
  [/\bbanquillo\b/gi, 'banco'],
  [/\bcabecera\b/gi, 'extremo'],
  [/\bpalma de tu mano\b/gi, 'palma de la mano'],
  [/\bpalmas de tu mano\b/gi, 'palmas de las manos'],
  [/\bimperdibles\b/g, 'pasadores de seguridad'],
  [/\btopes de seguridad\b/g, 'topes'],
  [/\bmáquina desplegable\b/gi, 'máquina de jalón al pecho'],
  [/\bdiscos de pesas\b/gi, 'discos'],
  [/\bplacas\b/gi, 'discos'],
  [/\blibras\b/gi, 'kg'],
  [/\b36 pulgadas\b/gi, '90 centímetros'],
  [/\btrasero\b/gi, 'cola'],
  [/\bnúcleo\b/gi, 'core'],
  [/\bcentro corporal\b/gi, 'core'],
]

// ---------- voseo: formas de usted -> vos (no ambiguas en este corpus) ----------
// Nota: Agarre/Ajuste/Empuje tienen uso como SUSTANTIVO, se manejan aparte con guarda.
const VOSEO_USTED = [
  [/\bAcuéstese\b/g, 'Acostate'], [/\bacuéstese\b/g, 'acostate'],
  [/\bRecuéstese\b/g, 'Recostate'], [/\brecuéstese\b/g, 'recostate'],
  [/\bColoque\b/g, 'Colocá'], [/\bcoloque\b/g, 'colocá'],
  [/\bAsegure\b/g, 'Asegurá'], [/\basegure\b/g, 'asegurá'],
  [/\bFlexione\b/g, 'Flexioná'], [/\bflexione\b/g, 'flexioná'],
  [/\bEleve\b/g, 'Elevá'], [/\beleve\b/g, 'elevá'],
  [/\bExhale\b/g, 'Exhalá'], [/\bexhale\b/g, 'exhalá'],
  [/\bInhale\b/g, 'Inhalá'], [/\binhale\b/g, 'inhalá'],
  [/\bRespire\b/g, 'Respirá'], [/\brespire\b/g, 'respirá'],
  [/\bRepita\b/g, 'Repetí'], [/\brepita\b/g, 'repetí'],
  [/\bRegrese\b/g, 'Regresá'], [/\bregrese\b/g, 'regresá'],
  [/\bVuelva\b/g, 'Volvé'], [/\bvuelva\b/g, 'volvé'],
  [/\bSostenga\b/g, 'Sostené'], [/\bsostenga\b/g, 'sostené'],
  [/\bComience\b/g, 'Comenzá'], [/\bcomience\b/g, 'comenzá'],
  [/\bEmpiece\b/g, 'Empezá'], [/\bempiece\b/g, 'empezá'],
  [/\bMueva\b/g, 'Mové'], [/\bmueva\b/g, 'mové'],
  [/\bEvite\b/g, 'Evitá'], [/\bevite\b/g, 'evitá'],
  [/\bMantenga\b/g, 'Mantené'], [/\bmantenga\b/g, 'mantené'],
  [/\bLevante\b/g, 'Levantá'], [/\blevante\b/g, 'levantá'],
  [/\bBaje\b/g, 'Bajá'], [/\bbaje\b/g, 'bajá'],
  [/\bEstire\b/g, 'Estirá'], [/\bestire\b/g, 'estirá'],
  [/\bExtienda\b/g, 'Extendé'], [/\bextienda\b/g, 'extendé'],
  [/\bGire\b/g, 'Girá'], [/\bgire\b/g, 'girá'],
  [/\bRote\b/g, 'Rotá'], [/\brote\b/g, 'rotá'],
  [/\bSujete\b/g, 'Sujetá'], [/\bsujete\b/g, 'sujetá'],
  [/\bTome\b/g, 'Tomá'], [/\btome\b/g, 'tomá'],
  [/\bSuelte\b/g, 'Soltá'], [/\bsuelte\b/g, 'soltá'],
  [/\bApriete\b/g, 'Apretá'], [/\bapriete\b/g, 'apretá'],
  [/\bContraiga\b/g, 'Contraé'], [/\bcontraiga\b/g, 'contraé'],
  [/\bEnderece\b/g, 'Enderezá'], [/\benderece\b/g, 'enderezá'],
  [/\bIncline\b/g, 'Incliná'], [/\bincline\b/g, 'incliná'],
  [/\bDescanse\b/g, 'Descansá'], [/\bdescanse\b/g, 'descansá'],
  [/\bContinúe\b/g, 'Continuá'], [/\bcontinúe\b/g, 'continuá'],
  [/\bRealice\b/g, 'Realizá'], [/\brealice\b/g, 'realizá'],
  [/\bEjecute\b/g, 'Ejecutá'], [/\bejecute\b/g, 'ejecutá'],
  [/\bUtilice\b/g, 'Utilizá'], [/\butilice\b/g, 'utilizá'],
  [/\bPárese\b/g, 'Parate'], [/\bpárese\b/g, 'parate'],
  [/\bSiéntese\b/g, 'Sentate'], [/\bsiéntese\b/g, 'sentate'],
  [/\bArrodíllese\b/g, 'Arrodíllate'], [/\barrodíllese\b/g, 'arrodíllate'],
  [/\bQuédese\b/g, 'Quedate'], [/\bquédese\b/g, 'quedate'],
  [/\bAléjese\b/g, 'Alejate'], [/\baléjese\b/g, 'alejate'],
  [/\bAcérquese\b/g, 'Acercate'], [/\bacérquese\b/g, 'acercate'],
  [/\bRetire\b/g, 'Retirá'], [/\bretire\b/g, 'retirá'],
  [/\bDevuelva\b/g, 'Devolvé'], [/\bdevuelva\b/g, 'devolvé'],
  [/\bIntente\b/g, 'Intentá'], [/\bintente\b/g, 'intentá'],
  [/\bTrate\b/g, 'Tratá'], [/\btrate\b/g, 'tratá'],
  [/\bPermita\b/g, 'Permití'], [/\bpermita\b/g, 'permití'],
  [/\bHaga\b/g, 'Hacé'], [/\bhaga\b/g, 'hacé'],
  [/\bTenga\b/g, 'Tené'], [/\btenga\b/g, 'tené'],
  [/\bSalga\b/g, 'Salí'], [/\bsalga\b/g, 'salí'],
  [/\bSuba\b/g, 'Subí'], [/\bsuba\b/g, 'subí'],  [/\bConduzca\b/g, 'Conducí'], [/\bconduzca\b/g, 'conducí'],
  [/\bSeleccione\b/g, 'Elegí'], [/\bseleccione\b/g, 'elegí'],
  [/\bElija\b/g, 'Elegí'], [/\belija\b/g, 'elegí'],
  [/\bCargue\b/g, 'Cargá'], [/\bcargue\b/g, 'cargá'],
  [/\bFije\b/g, 'Fijá'], [/\bfije\b/g, 'fijá'],
  [/\bRelaje\b/g, 'Relajá'], [/\brelaje\b/g, 'relajá'],
  [/\bLleve\b/g, 'Llevá'], [/\blleve\b/g, 'llevá'],
  [/\bAsuma\b/g, 'Tomá'], [/\basuma\b/g, 'tomá'],
  [/\bInicie\b/g, 'Iniciá'], [/\binicie\b/g, 'iniciá'],
  [/\bBloquee\b/g, 'Bloqueá'], [/\bbloquee\b/g, 'bloqueá'],
  [/\bDesenganche\b/g, 'Liberá'], [/\bdesenganche\b/g, 'liberá'],
  [/\bEnganche\b/g, 'Enganchá'], [/\benganche\b/g, 'enganchá'],
  [/\bReposicione\b/g, 'Reposicionate'], [/\breposicione\b/g, 'reposicionate'],
  [/\bReciba\b/g, 'Recibí'], [/\breciba\b/g, 'recibí'],
  [/\bInclínese\b/g, 'Incliná'], [/\binclínese\b/g, 'incliná'],
  [/\bTire\b/g, 'Tirá'], [/\btire\b/g, 'tirá'],
  [/\bJale\b/g, 'Jalá'], [/\bjale\b/g, 'jalá'],
  [/\bSiéntate\b/g, 'Sentate'], [/\bsiéntate\b/g, 'sentate'],
  [/\bColócate\b/g, 'Colocate'], [/\bcolócate\b/g, 'colocate'],
  [/\bNecesitará\b/g, 'Necesitás'], [/\bnecesitará\b/g, 'necesitás'],
  [/\bPárate\b/g, 'Parate'], [/\bpárate\b/g, 'parate'],
  [/\bPresione\b/g, 'Presioná'], [/\bpresione\b/g, 'presioná'],
  [/\bajústala\b/g, 'ajustala'], [/\bAjústala\b/g, 'Ajustala'],
  [/\bRecupérese\b/g, 'Recuperate'], [/\brecupérese\b/g, 'recuperate'],
  [/\bAsegúrese\b/g, 'Asegurate'], [/\basegúrese\b/g, 'asegurate'],
  [/\bConcéntrese\b/g, 'Concentrate'], [/\bconcéntrese\b/g, 'concentrate'],
  [/\bRelájese\b/g, 'Relajate'], [/\brelájese\b/g, 'relajate'],
  [/\bMuévase\b/g, 'Movete'], [/\bmuévase\b/g, 'movete'],
  [/\bAcuéstese\b/g, 'Acostate'],
  [/\bSujétate\b/g, 'Agarrate'], [/\bsujétate\b/g, 'agarrate'],
  [/\bTúmbese\b/g, 'Acostate'], [/\btúmbese\b/g, 'acostate'],
]

// ---------- voseo: verbos que también existen como sustantivo (agarre/ajuste/empuje) ----------
const NOUN_VERB = [
  [/\b([Aa])garre\b(?=\s+(la|el|los|las|ambas|ambos)\b)/g, (m, a) => a + 'garrá'],
  [/\b([Aa])juste\b(?=\s+(la|el|los|las|su|tu)\b)/g, (m, a) => a + 'justá'],
  [/\b([Ee])mpuje\b(?=\s+(la|el|los|las|hacia|hasta)\b)/g, (m, a) => a + 'mpujá'],
]

// ---------- voseo: formas de tú -> vos (solo ante palabra que confirma uso imperativo) ----------
const TU_GUARDED = /\b(coloca|levanta|baja|empuja|tira|tire|jala|jale|estira|mantiene|realiza|utiliza|usa|repite|regresa|vuelve|comienza|empieza|mueve|gira|rota|aprieta|sujeta|agarra|toma|suelta|descansa|continúa|inclina|extiende|flexiona|exhala|inhala|respira|evita|permite|asegura|arquea|endereza|concentra|siente|queda|acerca|aleja|lleva|deja|haz|ten|sigue|pon|ponte|acuesta|recuesta|salta|pausa|frena|controla|sostén|sostiene|abre|cierra|junta|separa|sube|entra|saca|mete)\b(?=\s+(el|la|los|las|tu|tus|un|una|unos|unas|dos|tres|cuatro|ambas|ambos|hacia|hasta|despacio|lentamente|fuerte|de|a|con|por|para|sin|entre|sobre|bajo|desde|y|e|mientras|arriba|abajo|adelante|atrás)\b)/gi
const TU_TO_VOSEO = {
  coloca: 'colocá', levanta: 'levantá', baja: 'bajá', empuja: 'empujá', tira: 'tirá',
  estira: 'estirá', mantiene: 'mantené', realiza: 'realizá', utiliza: 'utilizá',
  usa: 'usá', repite: 'repetí', regresa: 'regresá', vuelve: 'volvé', comienza: 'comenzá',
  empieza: 'empezá', mueve: 'mové', gira: 'girá', rota: 'rotá', aprieta: 'apretá',
  sujeta: 'sujetá', agarra: 'agarrá', toma: 'tomá', suelta: 'soltá', descansa: 'descansá',
  'continúa': 'continuá', inclina: 'incliná', extiende: 'extendé', flexiona: 'flexioná',
  exhala: 'exhalá', inhala: 'inhalá', respira: 'respirá', evita: 'evitá', permite: 'permití',
  asegura: 'asegurá', arquea: 'arqueá', endereza: 'enderezá', concentra: 'concentrate',
  siente: 'sentí', queda: 'quedate', acerca: 'acercá', aleja: 'alejá', lleva: 'llevá',
  deja: 'dejá', haz: 'hacé', ten: 'tené', sigue: 'seguí', pon: 'ponete', ponte: 'ponete',
  acuesta: 'acostate', recuesta: 'recostate', salta: 'saltá', jala: 'jalá', tire: 'tirá',
  jale: 'jalá', pausa: 'pausá', frena: 'frená', controla: 'controlá', sostén: 'sostené',
  sostiene: 'sostené', abre: 'abrí', cierra: 'cerrá', junta: 'juntá', separa: 'separá',
  sube: 'subí', entra: 'entrá', saca: 'sacá', mete: 'meté',
}

// ---------- presente 2ª persona en subordinadas (que/al/cuando/mientras + verbo) ----------
const SUBORD_PRESENT = [
  [/(?<=\b(?:que|al|cuando|[Mm]ientras)\s+)(levanta|baja|sube|empuja|tira|gira|mueve|coloca|sostiene|exhala|inhala|respira|mantiene|realiza|hace|llega|siente|empieza|comienza|vuelve|regresa|termina|dobla|extiende|flexiona|desciende|ejecuta|agrega|retorna)\b/g,
    (m) => ({
      levanta: 'levantás', baja: 'bajás', sube: 'subís', empuja: 'empujás', tira: 'tirás',
      gira: 'girás', mueve: 'movés', coloca: 'colocás', sostiene: 'sostenés',
      exhala: 'exhalás', inhala: 'inhalás', respira: 'respirás', mantiene: 'mantenés',
      realiza: 'realizás', hace: 'hacés', llega: 'llegás', siente: 'sentís',
      empieza: 'empezás', comienza: 'comenzás', vuelve: 'volvés', regresa: 'regresás',
      termina: 'terminás', dobla: 'doblás', extiende: 'extendés', flexiona: 'flexionás',
      desciende: 'descendés', ejecuta: 'ejecutás', agrega: 'agregás', retorna: 'retornás',
    }[m]),
  ],
]

function normalize(es) {
  let out = es
  for (const [re, rep] of TERM_FIXES) {
    if (!re) continue
    out = out.replace(re, rep)
  }
  for (const [re, rep] of VOSEO_USTED) out = out.replace(re, rep)
  for (const [re, rep] of NOUN_VERB) out = out.replace(re, rep)
  // primero subordinadas (presente), después imperativos con guarda
  for (const [re, rep] of SUBORD_PRESENT) out = out.replace(re, rep)
  out = out.replace(TU_GUARDED, (m) => {
    const key = m.trim().toLowerCase()
    const rep = TU_TO_VOSEO[key] ?? m
    return /^[A-ZÁÉÍÓÚÜÑ]/.test(m) ? rep.charAt(0).toUpperCase() + rep.slice(1) : rep
  })
  // posesivos y pronombres: todo en segunda persona informal
  out = out.replace(/\bsus\b/g, 'tus').replace(/\bsu\b/g, 'tu')
  out = out.replace(/\bUsted\b/g, 'Vos').replace(/\busted\b/g, 'vos')
  // género con "soporte" (masc.)
  out = out.replace(/\buna soporte\b/g, 'un soporte')
  out = out.replace(/\bLa soporte\b/g, 'El soporte')
  out = out.replace(/\bla soporte\b/g, 'el soporte')
  out = out.replace(/\bLas soportes\b/g, 'Los soportes')
  out = out.replace(/\blas soportes\b/g, 'los soportes')
  out = out.replace(/\bEsta soporte\b/g, 'Este soporte')
  out = out.replace(/\besta soporte\b/g, 'este soporte')
  // restos comunes
  out = out.replace(/\bes diestro\b/g, 'sos diestro')
  out = out.replace(/\bes zurdo\b/g, 'sos zurdo')
  out = out.replace(/\bmi preferencia\b/g, 'recomendado')
  out = out.replace(/\byour breathe in\b/gi, '') // por si quedara texto EN

  // segunda ronda: residuos frecuentes
  // exhala/inhala al final de cláusula
  out = out.replace(/\b(exhala|inhala|respira)\b(?=\s*[.,;)]|$)/gm, (m) =>
    ({ exhala: 'exhalá', inhala: 'inhalá', respira: 'respirá' }[m]))
  // presente de tú -> voseo
  out = out.replace(/\bpuedes\b/g, 'podés')
  out = out.replace(/\btienes\b/g, 'tenés')
  out = out.replace(/\bquieres\b/g, 'querés')
  out = out.replace(/\bnecesitas\b/g, 'necesitás')
  out = out.replace(/\brealizas\b/g, 'realizás')
  out = out.replace(/\bhaces\b/g, 'hacés')
  out = out.replace(/\bsientes\b/g, 'sentís')
  // tú imperativos sueltos
  out = out.replace(/\bAcércate\b/g, 'Acercate').replace(/\bacércate\b/g, 'acercate')
  out = out.replace(/\bconcéntrate\b/g, 'concentrate').replace(/\bConcéntrate\b/g, 'Concentrate')
  out = out.replace(/\bintenta\b/g, 'intentá').replace(/\bIntenta\b/g, 'Intentá')
  out = out.replace(/\bselecciona\b/g, 'seleccioná').replace(/\bSelecciona\b/g, 'Seleccioná')
  // "frente a ti" etc.
  out = out.replace(/\ba ti\b/g, 'a vos').replace(/\bcontigo\b/g, 'con vos')
  // género tras manijas->mangos
  out = out.replace(/\blas mangos\b/g, 'los mangos')
  out = out.replace(/\bla mango\b/g, 'el mango').replace(/\buna mango\b/g, 'un mango')
  // fórmulas del traductor que suenan rígidas
  out = out.replace(/Esta será tu posición inicial\.?/g, 'Esta es la posición inicial.')
  out = out.replace(/Esta será la posición inicial\.?/g, 'Esta es la posición inicial.')
  out = out.replace(/\bComenzarás\b/g, 'Comenzá').replace(/\bcomenzarás\b/g, 'comenzá')
  // Doble/Saque de usted con guarda (evita sustantivos como "agarre doble")
  out = out.replace(/\b([Dd])oble\b(?=\s+(las?|los?|el|le|tu|tus|sus|hacia|hasta|ligeramente|despacio)\b)/g, (m, a) => a + 'oblá')
  out = out.replace(/\b([Ss])aque\b/g, (m, a) => (a === 'S' ? 'Sacá' : 'sacá'))
  // género tras reemplazos
  out = out.replace(/\bel cola\b/g, 'la cola').replace(/\bdel cola\b/g, 'de la cola')

  out = out.replace(/\s{2,}/g, ' ')
  out = out.replace(/\s+([.,;:)])/g, '$1')
  out = out.replace(/\(\s+/g, '(')
  return out.trim()
}

async function main() {
  const seed = JSON.parse(await readFile(DATA, 'utf8'))
  const cache = JSON.parse(await readFile(CACHE, 'utf8').catch(() => '{}'))

  const unique = new Set()
  for (const ex of seed.exercises) for (const i of ex.instructions ?? []) if (i.trim()) unique.add(i)

  let overridden = 0
  let normalized = 0
  const result = new Map()
  for (const en of unique) {
    if (OVERRIDES[en] != null) {
      result.set(en, OVERRIDES[en])
      overridden++
      continue
    }
    const gt = cache[en]
    if (!gt) continue
    result.set(en, normalize(gt))
    normalized++
  }

  console.log(`Únicas: ${unique.size} | a mano: ${overridden} | normalizadas: ${normalized}`)

  // overrides que no matchearon (clave con typo)
  const corpusSet = unique
  const missed = Object.keys(OVERRIDES).filter((k) => !corpusSet.has(k))
  if (missed.length) {
    console.log(`\nOVERRIDES SIN MATCH (${missed.length}):`)
    for (const k of missed.slice(0, 10)) console.log(' -', k.slice(0, 100))
  }

  let steps = 0
  let withEs = 0
  for (const ex of seed.exercises) {
    const es = (ex.instructions ?? [])
      .map((i) => i.trim() && result.get(i))
      .filter(Boolean)
    if (es.length) {
      ex.instructions_es = es
      withEs++
      steps += es.length
    } else {
      delete ex.instructions_es
    }
  }
  await writeFile(DATA, JSON.stringify(seed, null, 2) + '\n')

  // muestra para revisión humana
  const sampleIdx = [...result.keys()].filter((k) => !OVERRIDES[k])
  console.log('\n--- MUESTRA NORMALIZADAS (10) ---')
  for (let i = 0; i < 10 && i < sampleIdx.length; i++) {
    const k = sampleIdx[Math.floor((i * sampleIdx.length) / 10)]
    console.log('EN:', k.slice(0, 90))
    console.log('ES:', result.get(k).slice(0, 110))
    console.log('')
  }
  console.log(`OK: ${withEs}/${seed.exercises.length} ejercicios (${steps} pasos)`)
}

main().catch((err) => {
  console.error('Error:', err.message)
  process.exit(1)
})
