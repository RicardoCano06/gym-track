import type { PostgrestFilterBuilder } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { enqueue, genId } from '@/lib/sync'
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

const PAGE_SIZE = 60

export async function fetchMuscles(): Promise<Muscle[]> {
  const { data, error } = await supabase.from('muscles').select('*').order('id')
  if (error) throw error
  return data ?? []
}

export async function fetchEquipment(): Promise<Equipment[]> {
  const { data, error } = await supabase.from('equipment').select('*').order('id')
  if (error) throw error
  return data ?? []
}

export interface ExerciseFilters {
  search?: string
  group?: string
  equipmentKind?: string
  category?: string
}

export async function fetchExercises(filters: ExerciseFilters, page: number) {
  if (filters.group) {
    const { data: muscles } = await supabase
      .from('muscles')
      .select('id')
      .eq('group_name', filters.group)
    if (!muscles?.length) return { exercises: [] as Exercise[], total: 0 }
    filters = { ...filters, group: undefined }
    const ids = muscles.map((m) => m.id)
    let q = supabase
      .from('exercises')
      .select('id, name, name_en, muscle_primary, muscle_secondary, equipment, category, image_url, level', {
        count: 'exact',
      })
      .in('muscle_primary', ids)
    if (filters.search) q = q.ilike('name', `%${filters.search}%`)
    if (filters.category) q = q.eq('category', filters.category)
    if (filters.equipmentKind) {
      const { data: eqs } = await supabase
        .from('equipment')
        .select('id')
        .eq('kind', filters.equipmentKind)
      if (!eqs?.length) return { exercises: [] as Exercise[], total: 0 }
      q = q.in('equipment', eqs.map((e) => e.id))
    }
    return paginate(q, page)
  }

  let q = supabase
    .from('exercises')
    .select('id, name, name_en, muscle_primary, muscle_secondary, equipment, category, image_url, level', {
      count: 'exact',
    })

  if (filters.search) q = q.ilike('name', `%${filters.search}%`)
  if (filters.category) q = q.eq('category', filters.category)
  if (filters.equipmentKind) {
    const { data: eqs } = await supabase
      .from('equipment')
      .select('id')
      .eq('kind', filters.equipmentKind)
    if (!eqs?.length) return { exercises: [] as Exercise[], total: 0 }
    q = q.in('equipment', eqs.map((e) => e.id))
  }
  return paginate(q, page)
}

type Query = PostgrestFilterBuilder<any, any, any, any, any, any>

async function paginate(q: Query, page: number) {
  const from = page * PAGE_SIZE
  const to = from + PAGE_SIZE - 1
  const { data, count, error } = await q.order('name').range(from, to)
  if (error) throw error
  return { exercises: (data ?? []) as Exercise[], total: count ?? 0 }
}

export async function fetchExerciseDetail(id: string) {
  const { data: exercise, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error

  const ids = [exercise.muscle_primary, ...(exercise.muscle_secondary ?? [])].filter(
    (x): x is number => typeof x === 'number',
  )
  let muscles: Muscle[] = []
  if (ids.length) {
    const { data } = await supabase.from('muscles').select('*').in('id', ids)
    muscles = data ?? []
  }

  let equipment: Equipment | null = null
  if (exercise.equipment) {
    const { data } = await supabase
      .from('equipment')
      .select('*')
      .eq('id', exercise.equipment)
      .single()
    equipment = data
  }

  return { exercise, muscles, equipment }
}

// ---------- Rutinas ----------

export async function fetchRoutines(userId: string): Promise<Routine[]> {
  const { data, error } = await supabase
    .from('routines')
    .select('*')
    .eq('user_id', userId)
    .order('created_at')
  if (error) throw error
  return (data ?? []) as Routine[]
}

export async function createRoutine(userId: string, name: string): Promise<Routine> {
  const { data, error } = await supabase
    .from('routines')
    .insert({ user_id: userId, name })
    .select()
    .single()
  if (error) throw error
  return data as Routine
}

export async function deleteRoutine(id: string) {
  const { error } = await supabase.from('routines').delete().eq('id', id)
  if (error) throw error
}

export async function fetchRoutineDetail(id: string) {
  const { data: routine, error } = await supabase
    .from('routines')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error

  const { data, error: err } = await supabase
    .from('routine_days')
    .select(
      '*, exercises:routine_exercises(*, exercises(id, name, image_url, muscle_primary, equipment))',
    )
    .eq('routine_id', id)
    .order('day_number')
    .order('position', { foreignTable: 'routine_exercises' })
  if (err) throw err

  const days: RoutineDay[] = ((data as RoutineDay[]) ?? []).map((day) => ({
    ...day,
    exercises: ((day.exercises ?? []) as RoutineExercise[]).map((re) => ({
      ...re,
      exercise: (re as unknown as { exercises: Exercise }).exercises,
    })),
  }))

  return { routine: routine as Routine, days }
}

export async function createDay(
  routineId: string,
  dayNumber: number,
  name: string,
  weekday?: string | null,
  goal?: string | null,
) {
  const { data, error } = await supabase
    .from('routine_days')
    .insert({
      routine_id: routineId,
      day_number: dayNumber,
      name,
      weekday: weekday || null,
      goal: goal || null,
    })
    .select()
    .single()
  if (error) throw error
  return data as RoutineDay
}

export async function updateDay(
  id: string,
  patch: Partial<Pick<RoutineDay, 'name' | 'weekday' | 'goal'>>,
) {
  const { error } = await supabase.from('routine_days').update(patch).eq('id', id)
  if (error) throw error
}

export async function deleteDay(id: string) {
  const { error } = await supabase.from('routine_days').delete().eq('id', id)
  if (error) throw error
}

export async function addExerciseToDay(
  dayId: string,
  exerciseId: string,
  position: number,
) {
  const { error } = await supabase.from('routine_exercises').insert({
    day_id: dayId,
    exercise_id: exerciseId,
    position,
    sets: 3,
    reps: '8-12',
    rest_seconds: 90,
  })
  if (error) throw error
}

export async function updateRoutineExercise(
  id: string,
  patch: Partial<
    Pick<RoutineExercise, 'sets' | 'reps' | 'rest_seconds' | 'superset_group'>
  >,
) {
  const { error } = await supabase.from('routine_exercises').update(patch).eq('id', id)
  if (error) throw error
}

export async function removeRoutineExercise(id: string) {
  enqueue('routine_exercise_remove', { id })
}

export async function fetchMuscleGroups(): Promise<string[]> {
  const { data, error } = await supabase.from('muscles').select('group_name')
  if (error) throw error
  const groups = new Set<string>()
  for (const m of data ?? []) if (m.group_name) groups.add(m.group_name)
  return [...groups].sort()
}

export async function fetchExercisesByGroup(
  group: string,
  limit = 20,
): Promise<Exercise[]> {
  const { data: muscles } = await supabase
    .from('muscles')
    .select('id')
    .eq('group_name', group)
  if (!muscles?.length) return []
  const { data, error } = await supabase
    .from('exercises')
    .select(
      'id, name, name_en, muscle_primary, muscle_secondary, equipment, category, image_url, level',
    )
    .in('muscle_primary', muscles.map((m) => m.id))
    .limit(limit)
  if (error) throw error
  return (data ?? []).sort(
    (a, b) =>
      (b.muscle_secondary?.length ?? 0) - (a.muscle_secondary?.length ?? 0),
  ) as Exercise[]
}

// ---------- Sesiones ----------

export async function fetchDayDetail(dayId: string): Promise<RoutineDay> {
  const { data, error } = await supabase
    .from('routine_days')
    .select('*, exercises:routine_exercises(*, exercises(id, name, image_url, muscle_primary))')
    .eq('id', dayId)
    .single()
  if (error) throw error

  const day = data as RoutineDay
  return {
    ...day,
    exercises: ((day.exercises ?? []) as RoutineExercise[]).map((re) => ({
      ...re,
      exercise: (re as unknown as { exercises: Exercise }).exercises,
    })),
  }
}

export async function findActiveSession(
  userId: string,
  dayId: string,
): Promise<Session | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .eq('day_id', dayId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as Session | null
}

export async function startSession(userId: string, dayId: string): Promise<Session> {
  const { data, error } = await supabase
    .from('sessions')
    .insert({ user_id: userId, day_id: dayId })
    .select()
    .single()
  if (error) throw error
  return data as Session
}

export async function deleteSessionSet(id: string) {
  enqueue('session_set_delete', { id })
}

export async function finishSession(
  id: string,
  durationMinutes: number,
  feeling: number | null,
  notes?: string,
) {
  enqueue('session_finish', {
    id,
    ended_at: new Date().toISOString(),
    duration_minutes: durationMinutes,
    feeling,
    notes,
  })
}

export async function deleteSession(id: string) {
  const { error: e1 } = await supabase.from('session_sets').delete().eq('session_id', id)
  if (e1) throw e1
  const { error } = await supabase.from('sessions').delete().eq('id', id)
  if (error) throw error
}

export async function fetchSessionSets(sessionId: string): Promise<SessionSet[]> {
  const { data, error } = await supabase
    .from('session_sets')
    .select('*')
    .eq('session_id', sessionId)
    .order('set_number')
  if (error) throw error
  return (data ?? []) as SessionSet[]
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
  const withId = row.id ? row : { ...row, id: genId() }
  enqueue('session_set_upsert', withId as unknown as Record<string, unknown>)
  return withId as SessionSet
}

export async function fetchSessions(userId: string) {
  const { data, error } = await supabase
    .from('sessions')
    .select('*, routine_days(name, day_number), routines(name)')
    .eq('user_id', userId)
    .order('started_at', { ascending: false })
    .limit(60)
  if (error) throw error
  return (data ?? []) as (Session & {
    routine_days: { name: string | null; day_number: number } | null
    routines: { name: string } | null
  })[]
}

export async function fetchSessionSetsWithExercises(sessionId: string) {
  const { data, error } = await supabase
    .from('session_sets')
    .select('*, exercises(id, name, image_url)')
    .eq('session_id', sessionId)
    .order('exercise_id')
    .order('set_number')
  if (error) throw error
  return (data ?? []) as (SessionSet & {
    exercises: Pick<Exercise, 'id' | 'name' | 'image_url'>
  })[]
}

// ---------- Perfil y medidas corporales ----------

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as UserProfile | null
}

export async function saveUserProfile(
  userId: string,
  patch: Partial<Pick<UserProfile, 'height_cm' | 'age' | 'sex' | 'level' | 'goal'>>,
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('user_profiles')
    .upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  return data as UserProfile
}

export async function fetchBodyMetrics(
  userId: string,
  limit = 30,
): Promise<BodyMetric[]> {
  const { data, error } = await supabase
    .from('body_metrics')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []) as BodyMetric[]
}

export async function saveBodyMetric(
  userId: string,
  weightKg: number,
  notes?: string,
): Promise<BodyMetric> {
  const row = {
    id: genId(),
    user_id: userId,
    date: new Date().toISOString().slice(0, 10),
    weight_kg: weightKg,
    notes: notes ?? null,
  }
  enqueue('body_metric_upsert', row as unknown as Record<string, unknown>)
  return row as BodyMetric
}

// ---------- Volumen semanal por músculo ----------

export interface MuscleVolume {
  group_name: string
  sets: number
}

export async function fetchWeeklyMuscleVolume(
  userId: string,
  weekStart: string,
): Promise<MuscleVolume[]> {
  const { data, error } = await supabase
    .from('session_sets')
    .select('exercises(muscle_primary, muscles(group_name)), sessions(started_at, ended_at)')
    .eq('completed', true)
    .eq('sessions.user_id', userId)
    .gte('sessions.started_at', weekStart)
    .not('sessions.ended_at', 'is', null)
  if (error) throw error

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    const ex = row as unknown as {
      exercises: { muscle_primary: number | null; muscles: { group_name: string } | null } | null
    }
    const group = ex.exercises?.muscles?.group_name
    if (group) counts.set(group, (counts.get(group) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([group_name, sets]) => ({ group_name, sets }))
    .sort((a, b) => b.sets - a.sets)
}

export async function countSessionsSince(
  userId: string,
  since: string,
): Promise<number> {
  const { count, error } = await supabase
    .from('sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('started_at', since)
    .not('ended_at', 'is', null)
  if (error) throw error
  return count ?? 0
}

// ---------- Próxima sesión y sesión en curso ----------

export interface NextSession {
  dayId: string
  routineId: string
  routineName: string
  dayName: string
  weekday: string
  exerciseCount: number
  daysAhead: number
}

export async function fetchNextSession(userId: string): Promise<NextSession | null> {
  const { data, error } = await supabase
    .from('routine_days')
    .select('id, name, weekday, routines(id, name), routine_exercises(id)')
    .eq('routines.user_id', userId)
    .not('weekday', 'is', null)
  if (error) throw error

  const todayIdx = (new Date().getDay() + 6) % 7
  let best: NextSession | null = null
  for (const row of (data ?? []) as Array<{
    id: string
    name: string | null
    weekday: string
    routines: Array<{ id: string; name: string }>
    routine_exercises: Array<{ id: string }>
  }>) {
    const idx = WEEKDAYS.indexOf(row.weekday as (typeof WEEKDAYS)[number])
    if (idx < 0) continue
    let ahead = idx - todayIdx
    if (ahead <= 0) ahead += 7
    if (!best || ahead < best.daysAhead) {
      best = {
        dayId: row.id,
        routineId: row.routines?.[0]?.id ?? '',
        routineName: row.routines?.[0]?.name ?? 'Rutina',
        dayName: row.name ?? `Día ${ahead}`,
        weekday: row.weekday,
        exerciseCount: row.routine_exercises?.length ?? 0,
        daysAhead: ahead,
      }
    }
  }
  return best
}

export type SuggestedSession = {
  routineId: string
  routineName: string
  dayId: string
  dayName: string
  lastTrainedAt: string | null
}

export async function fetchSuggestedSession(
  userId: string,
): Promise<SuggestedSession | null> {
  const { data: routines, error: e1 } = await supabase
    .from('routines')
    .select('id, name')
    .eq('user_id', userId)
  if (e1) throw e1
  if (!routines || routines.length === 0) return null

  const routineIds = routines.map((r) => r.id)
  const { data: days, error: e2 } = await supabase
    .from('routine_days')
    .select('id, routine_id, name')
    .in('routine_id', routineIds)
  if (e2) throw e2
  if (!days || days.length === 0) return null

  const { data: sessions, error: e3 } = await supabase
    .from('sessions')
    .select('day_id, started_at')
    .eq('user_id', userId)
    .not('ended_at', 'is', null)
    .in('day_id', days.map((d) => d.id))
  if (e3) throw e3

  const lastByDay = new Map<string, string>()
  for (const s of sessions ?? []) {
    const cur = lastByDay.get(s.day_id)
    if (!cur || s.started_at > cur) lastByDay.set(s.day_id, s.started_at)
  }

  let best: SuggestedSession | null = null
  for (const d of days) {
    const last = lastByDay.get(d.id) ?? null
    const candidate: SuggestedSession = {
      routineId: d.routine_id,
      routineName: routines.find((r) => r.id === d.routine_id)?.name ?? '',
      dayId: d.id,
      dayName: d.name,
      lastTrainedAt: last,
    }
    if (!best) {
      best = candidate
      continue
    }
    const bLast = best.lastTrainedAt
    if (last == null && bLast != null) {
      best = candidate
      continue
    }
    if (last != null && bLast != null && last < bLast) {
      best = candidate
    }
  }
  return best
}

export async function fetchActiveSession(userId: string): Promise<Session | null> {
  const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('user_id', userId)
    .is('ended_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as Session | null
}

// ---------- Progreso por ejercicio ----------

export interface ExerciseProgressEntry {
  session_id: string
  date: string
  weight_kg: number | null
  reps: number | null
  rpe: number | null
}

export async function fetchExerciseProgress(
  userId: string,
  exerciseId: string,
): Promise<ExerciseProgressEntry[]> {
  const { data, error } = await supabase
    .from('session_sets')
    .select('weight_kg, reps, rpe, sessions(id, started_at)')
    .eq('exercise_id', exerciseId)
    .eq('sessions.user_id', userId)
    .eq('completed', true)
    .not('sessions.ended_at', 'is', null)
  if (error) throw error
  return (data ?? [])
    .map((row) => {
      const r = row as unknown as {
        weight_kg: number | null
        reps: number | null
        rpe: number | null
        sessions: { id: string; started_at: string }
      }
      return {
        session_id: r.sessions.id,
        date: r.sessions.started_at,
        weight_kg: r.weight_kg,
        reps: r.reps,
        rpe: r.rpe,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

// ---------- Estadísticas ----------

export interface Streak {
  current: number
  best: number
}

export async function fetchStreak(userId: string): Promise<Streak> {
  const { data, error } = await supabase
    .from('sessions')
    .select('started_at')
    .eq('user_id', userId)
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
  if (error) throw error

  const days = new Set(
    (data ?? []).map((r) => new Date(r.started_at as string).toDateString()),
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

export interface WeeklyVolumePoint {
  weekStart: string
  group: string
  sets: number
}

export async function fetchWeeklyVolumeSeries(
  userId: string,
  weeks = 8,
): Promise<WeeklyVolumePoint[]> {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  monday.setHours(0, 0, 0, 0)
  const since = new Date(monday.getTime() - (weeks - 1) * 7 * 86400000)

  const { data, error } = await supabase
    .from('session_sets')
    .select('exercises(muscles(group_name)), sessions(started_at)')
    .eq('completed', true)
    .eq('sessions.user_id', userId)
    .not('sessions.ended_at', 'is', null)
    .gte('sessions.started_at', since.toISOString())
  if (error) throw error

  const map = new Map<string, number>()
  for (const row of (data ?? []) as unknown as Array<{
    exercises: { muscles: { group_name: string } | null } | null
    sessions: { started_at: string } | null
  }>) {
    const group = row.exercises?.muscles?.group_name
    const started = row.sessions?.started_at
    if (!group || !started) continue
    const d = new Date(started)
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

export interface PR {
  exerciseId: string
  name: string
  imageUrl: string | null
  maxWeight: number | null
  maxOneRm: number | null
  sessions: number
  lastDate: string
}

export async function fetchPRs(userId: string, limit = 8): Promise<PR[]> {
  const { data, error } = await supabase
    .from('session_sets')
    .select('weight_kg, reps, exercises(id, name, image_url), sessions(started_at)')
    .eq('completed', true)
    .eq('sessions.user_id', userId)
    .not('sessions.ended_at', 'is', null)
  if (error) throw error

  const byEx = new Map<string, PR>()
  for (const row of (data ?? []) as unknown as Array<{
    weight_kg: number | null
    reps: number | null
    exercises: { id: string; name: string; image_url: string | null } | null
    sessions: { started_at: string } | null
  }>) {
    const ex = row.exercises
    if (!ex) continue
    const entry = byEx.get(ex.id) ?? {
      exerciseId: ex.id,
      name: ex.name,
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
    const started = row.sessions?.started_at
    if (started && started > entry.lastDate) entry.lastDate = started
    byEx.set(ex.id, entry)
  }

  return [...byEx.values()]
    .filter((p) => p.maxWeight != null)
    .sort((a, b) => (b.maxOneRm ?? 0) - (a.maxOneRm ?? 0))
    .slice(0, limit)
}

// ---------- Export CSV ----------

export interface ExportRow {
  started_at: string
  routine_name: string | null
  day_name: string | null
  duration_minutes: number | null
  feeling: number | null
  set_number: number | null
  exercise_name: string | null
  weight_kg: number | null
  reps: number | null
  rpe: number | null
}

export async function fetchExportData(userId: string): Promise<ExportRow[]> {
  const { data, error } = await supabase
    .from('sessions')
    .select(
      'started_at, duration_minutes, feeling, routines(name), routine_days(name), session_sets(set_number, weight_kg, reps, rpe, exercises(name))',
    )
    .eq('user_id', userId)
    .not('ended_at', 'is', null)
    .order('started_at', { ascending: false })
  if (error) throw error

  const rows: ExportRow[] = []
  for (const session of data ?? []) {
    const s = session as unknown as {
      started_at: string
      duration_minutes: number | null
      feeling: number | null
      routines: { name: string } | null
      routine_days: { name: string | null } | null
      session_sets: {
        set_number: number
        weight_kg: number | null
        reps: number | null
        rpe: number | null
        exercises: { name: string } | null
      }[]
    }
    const base = {
      started_at: s.started_at,
      routine_name: s.routines?.name ?? null,
      day_name: s.routine_days?.name ?? null,
      duration_minutes: s.duration_minutes,
      feeling: s.feeling,
    }
    const sets = s.session_sets ?? []
    if (sets.length === 0) {
      rows.push({ ...base, set_number: null, exercise_name: null, weight_kg: null, reps: null, rpe: null })
    } else {
      for (const set of sets) {
        rows.push({
          ...base,
          set_number: set.set_number,
          exercise_name: set.exercises?.name ?? null,
          weight_kg: set.weight_kg,
          reps: set.reps,
          rpe: set.rpe,
        })
      }
    }
  }
  return rows
}