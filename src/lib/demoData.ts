// Espejo local de la capa de datos para el modo demo.
//
// Cuando isDemoMode() es true, db.ts delega aquí TODAS las operaciones:
// las lecturas se sirven desde el catálogo embebido + el historial generado
// (demoSeed), y las escrituras mutan el store local "vekt-local" — jamás
// tocan Supabase ("Blackhole"). Así el usuario demo crea rutinas y registra
// series con feedback instantáneo, de forma efímera y aislada.
import { genId } from '@/lib/sync'
import { DEMO_LOCAL_USER_ID, isLocalDemoMode } from '@/lib/demo'
import { supabase } from '@/lib/supabase'
import { buildDemoDataset, embeddedEquipment, embeddedExercises, embeddedMuscles } from '@/lib/demoSeed'
import { normalizeSearch } from '@/lib/search'
import * as store from '@/lib/demoStore'
import { WEEKDAYS } from '@/lib/constants'
import type {
  BodyMetric,
  Equipment,
  Exercise,
  Muscle,
  Routine,
  RoutineDay,
  RoutineExercise,
  Session,
  SessionSet,
  UserProfile,
} from '@/lib/types'

// ---------- tipos espejo de db.ts ----------

export interface ExerciseFilters {
  search?: string
  group?: string
  equipmentKind?: string
  category?: string
}

export interface MuscleVolume {
  group_name: string
  sets: number
}

export interface NextSession {
  dayId: string
  routineId: string
  routineName: string
  dayName: string
  weekday: string
  exerciseCount: number
  daysAhead: number
}

export interface SuggestedSession {
  routineId: string
  routineName: string
  dayId: string
  dayName: string
  lastTrainedAt: string | null
}

export interface ExerciseProgressEntry {
  session_id: string
  date: string
  weight_kg: number | null
  reps: number | null
  rpe: number | null
}

export interface Streak {
  current: number
  best: number
}

export interface WeeklyVolumePoint {
  weekStart: string
  group: string
  sets: number
}

export interface PR {
  exerciseId: string
  name: string
  name_en?: string | null
  imageUrl: string | null
  maxWeight: number | null
  maxOneRm: number | null
  sessions: number
  lastDate: string
}

export interface ExportRow {
  started_at: string
  routine_name: string | null
  day_name: string | null
  duration_minutes: number | null
  feeling: number | null
  set_number: number | null
  exercise_name: string | null
  exercise_name_en: string | null
  weight_kg: number | null
  reps: number | null
  rpe: number | null
}

// ---------- seed (idempotente) ----------

let seeding: Promise<void> | null = null
let seededUserId: string | null = null

async function ensureSeeded(userId: string): Promise<void> {
  if (seededUserId === userId) return
  if (seeding) {
    await seeding
    return
  }
  seeding = (async () => {
    const existing = await store.loadAll<Routine>('routines')
    if (existing.some((r) => r.user_id === DEMO_LOCAL_USER_ID)) {
      seededUserId = userId
      return
    }
    const data = buildDemoDataset(userId)
    for (const r of data.routines) await store.put('routines', r.id, r)
    for (const d of data.days) await store.put('routine_days', d.id, d)
    for (const re of data.routineExercises) await store.put('routine_exercises', re.id, re)
    for (const s of data.sessions) await store.put('sessions', s.id, s)
    for (const st of data.sets) await store.put('session_sets', st.id, st)
    for (const m of data.metrics) await store.put('body_metrics', m.id, m)
    await store.put('user_profiles', userId, data.profile)
    for (const ex of data.exercises) await store.put('exercises', ex.id, ex)
    for (const mu of data.muscles) await store.put('muscles', String(mu.id), mu)
    for (const eq of data.equipment) await store.put('equipment', String(eq.id), eq)
    seededUserId = userId
  })().finally(() => {
    seeding = null
  })
  await seeding
}

export function resetDemoData() {
  // El disco ya fue purgado por purgeDemoLocal(); acá solo se descarta el
  // estado en memoria para que el próximo ingreso demo resiembre desde cero.
  seededUserId = null
  seeding = null
}

// ---------- catálogo ----------
//
// El catálogo de ejercicios es PÚBLICO en Supabase (RLS lectura libre): en el
// modo demo online se sirve el catálogo REAL completo (867 ejercicios, con
// fotos e instrucciones). Solo el fallback "Demo Puramente Local" (sin red)
// usa el catálogo embebido de 12 ejercicios que acompaña al historial.

const CATALOG_PAGE_SIZE = 60

export async function fetchMuscles(): Promise<Muscle[]> {
  if (!isLocalDemoMode()) {
    const { data, error } = await supabase.from('muscles').select('*').order('id')
    if (!error && data) return data as Muscle[]
  }
  const rows = await store.loadAll<Muscle>('muscles')
  if (rows.length) return rows.sort((a, b) => a.id - b.id)
  return embeddedMuscles()
}

export async function fetchEquipment(): Promise<Equipment[]> {
  if (!isLocalDemoMode()) {
    const { data, error } = await supabase.from('equipment').select('*').order('id')
    if (!error && data) return data as Equipment[]
  }
  const rows = await store.loadAll<Equipment>('equipment')
  if (rows.length) return rows.sort((a, b) => a.id - b.id)
  return embeddedEquipment()
}

export async function fetchMuscleGroups(): Promise<string[]> {
  if (!isLocalDemoMode()) {
    const { data, error } = await supabase.from('muscles').select('group_name')
    if (!error && data) {
      const groups = new Set<string>()
      for (const m of data) if (m.group_name) groups.add(m.group_name)
      return [...groups].sort()
    }
  }
  const muscles = await fetchMuscles()
  const groups = new Set<string>()
  for (const m of muscles) if (m.group_name) groups.add(m.group_name)
  return [...groups].sort()
}

export async function fetchExercises(filters: ExerciseFilters, page: number): Promise<{ exercises: Exercise[]; total: number }> {
  if (!isLocalDemoMode()) {
    const filter = { ...filters }
    let q = supabase
      .from('exercises')
      .select('id, name, name_en, muscle_primary, muscle_secondary, equipment, category, image_url, level')
    if (filter.group) {
      const { data: muscles } = await supabase
        .from('muscles')
        .select('id')
        .eq('group_name', filter.group)
      if (!muscles?.length) return { exercises: [], total: 0 }
      q = q.in('muscle_primary', muscles.map((m) => m.id))
    }
    if (filter.category) q = q.eq('category', filter.category)
    if (filter.equipmentKind) {
      const { data: eqs } = await supabase
        .from('equipment')
        .select('id')
        .eq('kind', filter.equipmentKind)
      if (!eqs?.length) return { exercises: [], total: 0 }
      q = q.in('equipment', eqs.map((e) => e.id))
    }

    // Búsqueda: igual que el catálogo real — traer el subconjunto y filtrar en
    // el cliente normalizando acentos/mayúsculas (name y name_en).
    const search = (filter.search ?? '').trim()
    if (search) {
      const { data, error } = await q.order('name')
      if (error) throw error
      const term = normalizeSearch(search)
      const rows = (data ?? []) as Exercise[]
      const filtered = rows.filter((ex: Exercise) =>
        normalizeSearch(ex.name).includes(term) ||
        normalizeSearch(ex.name_en ?? '').includes(term),
      )
      const from = page * CATALOG_PAGE_SIZE
      return {
        exercises: filtered.slice(from, from + CATALOG_PAGE_SIZE),
        total: filtered.length,
      }
    }

    const { data, count, error } = await q.order('name').range(
      page * CATALOG_PAGE_SIZE,
      page * CATALOG_PAGE_SIZE + CATALOG_PAGE_SIZE - 1,
    )
    if (!error && data) {
      return { exercises: data as Exercise[], total: count ?? 0 }
    }
  }
  await ensureSeeded(DEMO_LOCAL_USER_ID)
  const rows = await store.loadAll<Exercise>('exercises')
  const muscles = await fetchMuscles()
  const equipment = await fetchEquipment()
  const muscleIds = new Set(
    filters.group ? muscles.filter((m) => m.group_name === filters.group).map((m) => m.id) : [],
  )
  const equipmentIds = new Set(
    filters.equipmentKind
      ? equipment.filter((e) => e.kind === filters.equipmentKind).map((e) => e.id)
      : [],
  )
  const all = rows.filter((ex) => {
    if (
      filters.search &&
      !normalizeSearch(ex.name).includes(normalizeSearch(filters.search)) &&
      !normalizeSearch(ex.name_en ?? '').includes(normalizeSearch(filters.search))
    )
      return false
    if (filters.group && !muscleIds.has(ex.muscle_primary ?? -1)) return false
    if (filters.equipmentKind && !equipmentIds.has(ex.equipment ?? -1)) return false
    if (filters.category && ex.category !== filters.category) return false
    return true
  })
  const sorted = [...all].sort((a, b) => a.name.localeCompare(b.name, 'es'))
  return {
    exercises: sorted.slice(page * CATALOG_PAGE_SIZE, page * CATALOG_PAGE_SIZE + CATALOG_PAGE_SIZE),
    total: sorted.length,
  }
}

export async function fetchExercisesByGroup(group: string, limit = 20): Promise<Exercise[]> {
  if (!isLocalDemoMode()) {
    const { data: muscles } = await supabase
      .from('muscles')
      .select('id')
      .eq('group_name', group)
    if (muscles?.length) {
      const { data, error } = await supabase
        .from('exercises')
        .select('id, name, name_en, muscle_primary, muscle_secondary, equipment, category, image_url, level')
        .in('muscle_primary', muscles.map((m) => m.id))
        .limit(limit)
      if (!error && data) {
        return (data as Exercise[]).sort(
          (a, b) =>
            (b.muscle_secondary?.length ?? 0) - (a.muscle_secondary?.length ?? 0),
        )
      }
    }
  }
  const muscles = await fetchMuscles()
  const ids = new Set(muscles.filter((m) => m.group_name === group).map((m) => m.id))
  const rows = await store.loadAll<Exercise>('exercises')
  return rows
    .filter((ex) => ids.has(ex.muscle_primary ?? -1))
    .sort((a, b) => (b.muscle_secondary?.length ?? 0) - (a.muscle_secondary?.length ?? 0))
    .slice(0, limit)
}

export async function fetchExerciseDetail(id: string): Promise<{
  exercise: Exercise
  muscles: Muscle[]
  equipment: Equipment | null
}> {
  if (!isLocalDemoMode()) {
    const { data: exercise, error } = await supabase
      .from('exercises')
      .select('*')
      .eq('id', id)
      .single()
    if (!error && exercise) {
      const ids = [exercise.muscle_primary, ...(exercise.muscle_secondary ?? [])].filter(
        (x): x is number => typeof x === 'number',
      )
      let muscles: Muscle[] = []
      if (ids.length) {
        const { data } = await supabase.from('muscles').select('*').in('id', ids)
        muscles = (data ?? []) as Muscle[]
      }
      let equipment: Equipment | null = null
      if (exercise.equipment) {
        const { data } = await supabase
          .from('equipment')
          .select('*')
          .eq('id', exercise.equipment)
          .single()
        equipment = (data ?? null) as Equipment | null
      }
      return { exercise: exercise as Exercise, muscles, equipment }
    }
  }
  const rows = await store.loadAll<Exercise>('exercises')
  const exercise = rows.find((e) => e.id === id) ?? (await embeddedExercises(new Date().toISOString()))[0]
  const muscles = await fetchMuscles()
  const equipment = await fetchEquipment()
  const ids = [exercise.muscle_primary, ...(exercise.muscle_secondary ?? [])].filter(
    (x): x is number => typeof x === 'number',
  )
  return {
    exercise,
    muscles: muscles.filter((m) => ids.includes(m.id)),
    equipment: exercise.equipment ? (equipment.find((e) => e.id === exercise.equipment) ?? null) : null,
  }
}

// ---------- rutinas ----------

async function getRoutines(_userId: string): Promise<Routine[]> {
  await ensureSeeded(DEMO_LOCAL_USER_ID)
  const rows = await store.loadAll<Routine>('routines')
  return rows.filter((r) => r.user_id === DEMO_LOCAL_USER_ID)
}

export async function fetchRoutines(userId: string): Promise<Routine[]> {
  const rows = await getRoutines(userId)
  return [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at))
}

export async function createRoutine(_userId: string, name: string): Promise<Routine> {
  const routine: Routine = {
    id: genId(),
    user_id: DEMO_LOCAL_USER_ID,
    name,
    description: '',
    created_at: new Date().toISOString(),
  }
  await store.put('routines', routine.id, routine)
  return routine
}

export async function deleteRoutine(id: string) {
  const days = await store.loadAll<RoutineDay>('routine_days')
  const mine = days.filter((d) => d.routine_id === id)
  const dayIds = new Set(mine.map((d) => d.id))
  const exercises = await store.loadAll<RoutineExercise>('routine_exercises')
  for (const re of exercises.filter((x) => dayIds.has(x.day_id))) {
    await store.remove('routine_exercises', re.id)
  }
  for (const d of mine) await store.remove('routine_days', d.id)
  const sessions = await store.loadAll<Session>('sessions')
  for (const s of sessions.filter((x) => x.routine_id === id || dayIds.has(x.day_id ?? ''))) {
    await store.put('sessions', s.id, { ...s, routine_id: null, day_id: null })
  }
  await store.remove('routines', id)
}

export async function fetchRoutineDetail(id: string): Promise<{ routine: Routine; days: RoutineDay[] }> {
  const routines = await store.loadAll<Routine>('routines')
  const routine = routines.find((r) => r.id === id)
  if (!routine) return { routine: { id, user_id: '', name: 'Rutina', description: null, created_at: '' }, days: [] }
  const days = await store.loadAll<RoutineDay>('routine_days')
  const exercises = await store.loadAll<RoutineExercise>('routine_exercises')
  const catalog = await store.loadAll<Exercise>('exercises')
  const mapped: RoutineDay[] = days
    .filter((d) => d.routine_id === id)
    .sort((a, b) => a.day_number - b.day_number)
    .map((d) => ({
      ...d,
      exercises: exercises
        .filter((re) => re.day_id === d.id)
        .sort((a, b) => a.position - b.position)
        .map((re) => ({
          ...re,
          exercise: catalog.find((e) => e.id === re.exercise_id) ?? undefined,
        })),
    }))
  return { routine, days: mapped }
}

export async function createDay(
  routineId: string,
  dayNumber: number,
  name: string,
  weekday?: string | null,
  goal?: string | null,
): Promise<RoutineDay> {
  const day: RoutineDay = {
    id: genId(),
    routine_id: routineId,
    day_number: dayNumber,
    name,
    weekday: weekday ?? null,
    goal: goal ?? null,
  }
  await store.put('routine_days', day.id, day)
  return day
}

export async function updateDay(
  id: string,
  patch: Partial<Pick<RoutineDay, 'name' | 'weekday' | 'goal'>>,
) {
  const rows = await store.loadAll<RoutineDay>('routine_days')
  const day = rows.find((d) => d.id === id)
  if (day) await store.put('routine_days', id, { ...day, ...patch })
}

export async function deleteDay(id: string) {
  const exercises = await store.loadAll<RoutineExercise>('routine_exercises')
  for (const re of exercises.filter((x) => x.day_id === id)) {
    await store.remove('routine_exercises', re.id)
  }
  const sessions = await store.loadAll<Session>('sessions')
  for (const s of sessions.filter((x) => x.day_id === id)) {
    await store.put('sessions', s.id, { ...s, day_id: null })
  }
  await store.remove('routine_days', id)
}

export async function addExerciseToDay(dayId: string, exerciseId: string, position: number) {
  const re: RoutineExercise = {
    id: genId(),
    day_id: dayId,
    exercise_id: exerciseId,
    position,
    sets: 3,
    reps: '8-12',
    rest_seconds: 90,
    superset_group: null,
    notes: null,
  }
  await store.put('routine_exercises', re.id, re)
}

export async function updateRoutineExercise(
  id: string,
  patch: Partial<Pick<RoutineExercise, 'sets' | 'reps' | 'rest_seconds' | 'superset_group'>>,
) {
  const rows = await store.loadAll<RoutineExercise>('routine_exercises')
  const re = rows.find((x) => x.id === id)
  if (re) await store.put('routine_exercises', id, { ...re, ...patch })
}

export async function removeRoutineExercise(id: string) {
  await store.remove('routine_exercises', id)
}

export async function fetchDayDetail(dayId: string): Promise<RoutineDay> {
  const days = await store.loadAll<RoutineDay>('routine_days')
  const day = days.find((d) => d.id === dayId)
  if (!day) return { id: dayId, routine_id: '', day_number: 1, name: null, weekday: null, goal: null, exercises: [] }
  const exercises = await store.loadAll<RoutineExercise>('routine_exercises')
  const catalog = await store.loadAll<Exercise>('exercises')
  return {
    ...day,
    exercises: exercises
      .filter((re) => re.day_id === dayId)
      .sort((a, b) => a.position - b.position)
      .map((re) => ({ ...re, exercise: catalog.find((e) => e.id === re.exercise_id) })),
  }
}

// ---------- sesiones ----------

export async function findActiveSession(_userId: string, dayId: string): Promise<Session | null> {
  const rows = await store.loadAll<Session>('sessions')
  const hit = rows
    .filter((s) => s.user_id === DEMO_LOCAL_USER_ID && s.day_id === dayId && s.ended_at === null)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))[0]
  return hit ?? null
}

export async function startSession(_userId: string, dayId: string): Promise<Session> {
  const session: Session = {
    id: genId(),
    user_id: DEMO_LOCAL_USER_ID,
    routine_id: null,
    day_id: dayId,
    started_at: new Date().toISOString(),
    ended_at: null,
    duration_minutes: null,
    feeling: null,
    notes: '',
  }
  await store.put('sessions', session.id, session)
  return session
}

export async function deleteSessionSet(id: string) {
  await store.remove('session_sets', id)
}

export async function finishSession(
  id: string,
  durationMinutes: number,
  feeling: number | null,
  notes?: string,
) {
  const rows = await store.loadAll<Session>('sessions')
  const session = rows.find((s) => s.id === id)
  if (session) {
    await store.put('sessions', id, {
      ...session,
      ended_at: new Date().toISOString(),
      duration_minutes: durationMinutes,
      feeling,
      notes: notes ?? '',
    })
  }
}

export async function deleteSession(id: string) {
  const sets = await store.loadAll<SessionSet>('session_sets')
  for (const st of sets.filter((x) => x.session_id === id)) {
    await store.remove('session_sets', st.id)
  }
  await store.remove('sessions', id)
}

export async function fetchSessionSets(sessionId: string): Promise<SessionSet[]> {
  const rows = await store.loadAll<SessionSet>('session_sets')
  return rows
    .filter((s) => s.session_id === sessionId)
    .sort((a, b) => a.set_number - b.set_number)
}

export async function upsertSessionSet(row: {
  id?: string
  session_id: string
  exercise_id: string
  set_number: number
  weight_kg: number | null
  reps: number | null
  rpe: number | null
  completed: boolean
}): Promise<SessionSet> {
  const id = row.id ?? genId()
  const set: SessionSet = {
    id,
    session_id: row.session_id,
    exercise_id: row.exercise_id,
    set_number: row.set_number,
    weight_kg: row.weight_kg,
    reps: row.reps,
    rpe: row.rpe,
    completed: row.completed,
    notes: '',
  }
  await store.put('session_sets', id, set)
  return set
}

export async function fetchSessions(_userId: string) {
  const rows = await store.loadAll<Session>('sessions')
  const days = await store.loadAll<RoutineDay>('routine_days')
  const routines = await store.loadAll<Routine>('routines')
  return rows
    .filter((s) => s.user_id === DEMO_LOCAL_USER_ID)
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .slice(0, 60)
    .map((s) => ({
      ...s,
      routine_days: s.day_id ? (days.find((d) => d.id === s.day_id) ?? null) : null,
      routines: s.routine_id ? (routines.find((r) => r.id === s.routine_id) ?? null) : null,
    }))
}

export async function fetchSessionSetsWithExercises(sessionId: string) {
  const rows = await store.loadAll<SessionSet>('session_sets')
  const catalog = await store.loadAll<Exercise>('exercises')
  return rows
    .filter((s) => s.session_id === sessionId)
    .sort((a, b) => a.exercise_id.localeCompare(b.exercise_id) || a.set_number - b.set_number)
    .map((s) => {
      const ex = catalog.find((e) => e.id === s.exercise_id)
      return {
        ...s,
        exercises: {
          id: ex?.id ?? s.exercise_id,
          name: ex?.name ?? 'Ejercicio',
          image_url: ex?.image_url ?? null,
        },
      }
    })
}

// ---------- perfil y medidas ----------

export async function fetchUserProfile(_userId: string): Promise<UserProfile | null> {
  const rows = await store.loadAll<UserProfile>('user_profiles')
  return rows.find((p) => p.user_id === DEMO_LOCAL_USER_ID) ?? null
}

export async function saveUserProfile(
  _userId: string,
  patch: Partial<Pick<UserProfile, 'height_cm' | 'age' | 'sex' | 'level' | 'goal'>>,
): Promise<UserProfile> {
  const current = await fetchUserProfile(DEMO_LOCAL_USER_ID)
  const profile: UserProfile = {
    user_id: DEMO_LOCAL_USER_ID,
    height_cm: patch.height_cm ?? current?.height_cm ?? null,
    age: patch.age ?? current?.age ?? null,
    sex: patch.sex ?? current?.sex ?? null,
    level: patch.level ?? current?.level ?? 'principiante',
    goal: patch.goal ?? current?.goal ?? 'ganar_masa',
    updated_at: new Date().toISOString(),
  }
  await store.put('user_profiles', DEMO_LOCAL_USER_ID, profile)
  return profile
}

export async function fetchBodyMetrics(_userId: string, limit = 30): Promise<BodyMetric[]> {
  const rows = await store.loadAll<BodyMetric>('body_metrics')
  return rows
    .filter((m) => m.user_id === DEMO_LOCAL_USER_ID)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
}

export async function saveBodyMetric(_userId: string, weightKg: number, notes?: string): Promise<BodyMetric> {
  const metric: BodyMetric = {
    id: genId(),
    user_id: DEMO_LOCAL_USER_ID,
    date: new Date().toISOString().slice(0, 10),
    weight_kg: weightKg,
    notes: notes ?? null,
  }
  await store.put('body_metrics', metric.id, metric)
  return metric
}

// ---------- agregados (volumen, rachas, PRs, progreso, export) ----------

async function allSets(): Promise<SessionSet[]> {
  await ensureSeeded(DEMO_LOCAL_USER_ID)
  return store.loadAll<SessionSet>('session_sets')
}

async function allSessions(): Promise<Session[]> {
  await ensureSeeded(DEMO_LOCAL_USER_ID)
  return store.loadAll<Session>('sessions')
}

export async function fetchWeeklyMuscleVolume(
  _userId: string,
  weekStart: string,
): Promise<MuscleVolume[]> {
  const sets = await allSets()
  const exercises = await store.loadAll<Exercise>('exercises')
  const muscles = await fetchMuscles()
  const sessions = await allSessions()
  const counts = new Map<string, number>()
  for (const row of sets) {
    if (!row.completed) continue
    const session = sessions.find((s) => s.id === row.session_id)
    if (!session || session.ended_at === null || session.started_at < weekStart) continue
    const ex = exercises.find((e) => e.id === row.exercise_id)
    const group = muscles.find((m) => m.id === ex?.muscle_primary)?.group_name
    if (group) counts.set(group, (counts.get(group) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([group_name, sets]) => ({ group_name, sets }))
    .sort((a, b) => b.sets - a.sets)
}

export async function countSessionsSince(_userId: string, since: string): Promise<number> {
  const sessions = await allSessions()
  return sessions.filter((s) => s.started_at >= since && s.ended_at !== null).length
}

export async function fetchNextSession(_userId: string): Promise<NextSession | null> {
  const days = await store.loadAll<RoutineDay>('routine_days')
  const routines = await store.loadAll<Routine>('routines')
  const exercises = await store.loadAll<RoutineExercise>('routine_exercises')
  const todayIdx = (new Date().getDay() + 6) % 7
  let best: NextSession | null = null
  for (const row of days) {
    if (!row.weekday) continue
    const routine = routines.find((r) => r.id === row.routine_id)
    if (!routine || routine.user_id !== DEMO_LOCAL_USER_ID) continue
    const idx = WEEKDAYS.indexOf(row.weekday as (typeof WEEKDAYS)[number])
    if (idx < 0) continue
    let ahead = idx - todayIdx
    if (ahead <= 0) ahead += 7
    if (!best || ahead < best.daysAhead) {
      best = {
        dayId: row.id,
        routineId: routine.id,
        routineName: routine.name,
        dayName: row.name ?? `Día ${ahead}`,
        weekday: row.weekday,
        exerciseCount: exercises.filter((re) => re.day_id === row.id).length,
        daysAhead: ahead,
      }
    }
  }
  return best
}

export async function fetchSuggestedSession(
  _userId: string,
): Promise<SuggestedSession | null> {
  const routines = await store.loadAll<Routine>('routines')
  const mine = routines.filter((r) => r.user_id === DEMO_LOCAL_USER_ID)
  if (mine.length === 0) return null
  const days = await store.loadAll<RoutineDay>('routine_days')
  const sessions = await allSessions()
  const lastByDay = new Map<string, string>()
  for (const s of sessions) {
    if (s.ended_at === null) continue
    const cur = lastByDay.get(s.day_id ?? '')
    if (!cur || s.started_at > cur) lastByDay.set(s.day_id ?? '', s.started_at)
  }
  let best: SuggestedSession | null = null
  for (const d of days) {
    if (!mine.some((r) => r.id === d.routine_id)) continue
    const candidate: SuggestedSession = {
      routineId: d.routine_id,
      routineName: mine.find((r) => r.id === d.routine_id)?.name ?? '',
      dayId: d.id,
      dayName: d.name ?? 'Día',
      lastTrainedAt: lastByDay.get(d.id) ?? null,
    }
    if (!best) {
      best = candidate
      continue
    }
    const bLast = best.lastTrainedAt
    if (candidate.lastTrainedAt == null && bLast != null) {
      best = candidate
      continue
    }
    if (candidate.lastTrainedAt != null && bLast != null && candidate.lastTrainedAt < bLast) {
      best = candidate
    }
  }
  return best
}

export async function fetchActiveSession(_userId: string): Promise<Session | null> {
  const sessions = await allSessions()
  return sessions.filter((s) => s.ended_at === null).sort((a, b) => b.started_at.localeCompare(a.started_at))[0] ?? null
}

export async function fetchExerciseProgress(
  _userId: string,
  exerciseId: string,
): Promise<ExerciseProgressEntry[]> {
  const sets = await allSets()
  const sessions = await allSessions()
  return sets
    .filter((s) => s.exercise_id === exerciseId && s.completed)
    .map((s) => {
      const session = sessions.find((x) => x.id === s.session_id)
      return {
        session_id: s.session_id,
        date: session?.started_at ?? '',
        weight_kg: s.weight_kg,
        reps: s.reps,
        rpe: s.rpe,
      }
    })
    .filter((e) => e.date !== '')
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function fetchStreak(_userId: string): Promise<Streak> {
  const sessions = await allSessions()
  const days = new Set(
    sessions.filter((s) => s.ended_at !== null).map((s) => new Date(s.started_at).toDateString()),
  )
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  let current = 0
  let cursor = days.has(today.toDateString())
    ? today
    : new Date(today.getTime() - 86400000)
  if (days.has(cursor.toDateString())) {
    while (days.has(cursor.toDateString())) {
      current++
      cursor = new Date(cursor.getTime() - 86400000)
    }
  }
  const sorted = [...days].sort()
  let best = 0
  let run = 0
  let prev: Date | null = null
  for (const d of sorted) {
    const date = new Date(d)
    date.setHours(0, 0, 0, 0)
    run = prev && date.getTime() - prev.getTime() === 86400000 ? run + 1 : 1
    best = Math.max(best, run)
    prev = date
  }
  return { current, best }
}

export async function fetchWeeklyVolumeSeries(
  _userId: string,
  weeks = 8,
): Promise<WeeklyVolumePoint[]> {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  const since = new Date(monday.getTime() - (weeks - 1) * 7 * 86400000)
  const sets = await allSets()
  const sessions = await allSessions()
  const exercises = await store.loadAll<Exercise>('exercises')
  const muscles = await fetchMuscles()
  const map = new Map<string, number>()
  for (const row of sets) {
    if (!row.completed) continue
    const session = sessions.find((s) => s.id === row.session_id)
    if (!session || session.ended_at === null || session.started_at < since.toISOString()) continue
    const ex = exercises.find((e) => e.id === row.exercise_id)
    const group = muscles.find((m) => m.id === ex?.muscle_primary)?.group_name
    if (!group) continue
    const d = new Date(session.started_at)
    const wd = d.getDay()
    const ws = new Date(d)
    ws.setDate(d.getDate() + (wd === 0 ? -6 : 1 - wd))
    ws.setHours(0, 0, 0, 0)
    const key = `${ws.toISOString()}|${group}`
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()].map(([key, sets]) => {
    const [weekStart, group] = key.split('|')
    return { weekStart, group, sets }
  })
}

export async function fetchPRs(_userId: string, limit = 8): Promise<PR[]> {
  const sets = await allSets()
  const sessions = await allSessions()
  const exercises = await store.loadAll<Exercise>('exercises')
  const byEx = new Map<string, PR>()
  for (const row of sets) {
    if (!row.completed) continue
    const ex = exercises.find((e) => e.id === row.exercise_id)
    if (!ex) continue
    const session = sessions.find((s) => s.id === row.session_id)
    const entry = byEx.get(ex.id) ?? {
      exerciseId: ex.id,
      name: ex.name,
      name_en: ex.name_en,
      imageUrl: ex.image_url,
      maxWeight: null,
      maxOneRm: null,
      sessions: 0,
      lastDate: '',
    }
    entry.sessions++
    const weight = row.weight_kg ?? 0
    const reps = row.reps ?? 0
    if (weight > 0) {
      entry.maxWeight = entry.maxWeight == null ? weight : Math.max(entry.maxWeight, weight)
      const e1rm = reps > 0 ? weight * (1 + reps / 30) : weight
      entry.maxOneRm = entry.maxOneRm == null ? e1rm : Math.max(entry.maxOneRm, e1rm)
    }
    const started = session?.started_at
    if (started && started > entry.lastDate) entry.lastDate = started
    byEx.set(ex.id, entry)
  }
  return [...byEx.values()]
    .filter((p) => p.maxWeight != null)
    .sort((a, b) => (b.maxOneRm ?? 0) - (a.maxOneRm ?? 0))
    .slice(0, limit)
}

export async function fetchExportData(_userId: string): Promise<ExportRow[]> {
  const sessions = await allSessions()
  const sets = await allSets()
  const exercises = await store.loadAll<Exercise>('exercises')
  const days = await store.loadAll<RoutineDay>('routine_days')
  const routines = await store.loadAll<Routine>('routines')
  const rows: ExportRow[] = []
  for (const s of sessions.filter((x) => x.ended_at !== null).sort((a, b) => b.started_at.localeCompare(a.started_at))) {
    const day = s.day_id ? days.find((d) => d.id === s.day_id) : undefined
    const routine = s.routine_id ? routines.find((r) => r.id === s.routine_id) : undefined
    const base = {
      started_at: s.started_at,
      routine_name: routine?.name ?? null,
      day_name: day?.name ?? null,
      duration_minutes: s.duration_minutes,
      feeling: s.feeling,
    }
    const mine = sets.filter((st) => st.session_id === s.id)
    if (mine.length === 0) {
      rows.push({ ...base, set_number: null, exercise_name: null, exercise_name_en: null, weight_kg: null, reps: null, rpe: null })
    } else {
      for (const st of mine) {
        const ex = exercises.find((e) => e.id === st.exercise_id)
        rows.push({
          ...base,
          set_number: st.set_number,
          exercise_name: ex?.name ?? null,
          exercise_name_en: ex?.name_en ?? null,
          weight_kg: st.weight_kg,
          reps: st.reps,
          rpe: st.rpe,
        })
      }
    }
  }
  return rows
}