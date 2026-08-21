// Demo Sandbox: generador algoritmico de 180 dias de historial.
//
// Rigor matematico:
//  - Progresion lineal con ruido +/-2.5 kg y deload (x0.8) cada 42 dias.
//  - Cero nulos en metricas: peso, reps, RPE, fechas (ISO8601 estricto).
//  - Todo ejercicio mapea a muscle/equipment validos (ids del catalogo real).
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

// ---------- RNG determinista (mulberry32) ----------

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function uuidFromRng(rng: () => number): string {
  const hex = () => Math.floor(rng() * 16).toString(16)
  let s = ''
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      s += '-'
    } else if (i === 14) {
      s += '4'
    } else if (i === 19) {
      s += (8 + Math.floor(rng() * 4)).toString(16)
    } else {
      s += hex()
    }
  }
  return s
}

const round = (v: number, step = 0.5) => Math.round(v / step) * step

// ---------- Catalogo embebido (ids = catalogo real de produccion) ----------

const M: Record<string, Omit<Muscle, 'name_en'>> = {
  Abdominales: { id: 1, name: 'Abdominales', group_name: 'core' },
  Isquiotibiales: { id: 2, name: 'Isquiotibiales', group_name: 'pierna' },
  Aductores: { id: 3, name: 'Aductores', group_name: 'pierna' },
  Cuádriceps: { id: 4, name: 'Cuádriceps', group_name: 'pierna' },
  Bíceps: { id: 5, name: 'Bíceps', group_name: 'brazos' },
  Hombros: { id: 6, name: 'Hombros', group_name: 'hombros' },
  Pectorales: { id: 7, name: 'Pectorales', group_name: 'pecho' },
  Dorsales: { id: 8, name: 'Dorsales', group_name: 'espalda' },
  Gemelos: { id: 9, name: 'Gemelos', group_name: 'pierna' },
  Glúteos: { id: 10, name: 'Glúteos', group_name: 'pierna' },
  'Zona lumbar': { id: 11, name: 'Zona lumbar', group_name: 'espalda' },
  Tríceps: { id: 12, name: 'Tríceps', group_name: 'brazos' },
  Trapecios: { id: 13, name: 'Trapecios', group_name: 'espalda' },
  Antebrazos: { id: 14, name: 'Antebrazos', group_name: 'brazos' },
  Cuello: { id: 15, name: 'Cuello', group_name: 'espalda' },
  Abductores: { id: 16, name: 'Abductores', group_name: 'pierna' },
}

const EQ: Record<string, { id: number; name: string; kind: string }> = {
  'Peso corporal': { id: 1, name: 'Peso corporal', kind: 'bodyweight' },
  Máquina: { id: 2, name: 'Máquina', kind: 'machine' },
  Otros: { id: 3, name: 'Otros', kind: 'other' },
  'Pesa rusa': { id: 5, name: 'Pesa rusa', kind: 'free_weight' },
  Mancuerna: { id: 6, name: 'Mancuerna', kind: 'free_weight' },
  Polea: { id: 7, name: 'Polea', kind: 'cable' },
  Barra: { id: 8, name: 'Barra', kind: 'free_weight' },
}

interface ExerciseSpec {
  key: string
  name: string
  nameEn: string
  muscle: keyof typeof M
  secondary: Array<keyof typeof M>
  equipment: keyof typeof EQ
  force: 'push' | 'pull' | 'static'
  startKg: number
  endKg: number
  imageUrl: string
}

const EXERCISES: ExerciseSpec[] = [
  { key: 'bench', name: 'Press de banca agarre medio', nameEn: 'Barbell Bench Press - Medium Grip', muscle: 'Pectorales', secondary: ['Tríceps', 'Hombros'], equipment: 'Barra', force: 'push', startKg: 60, endKg: 85, imageUrl: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Bench_Press_-_Medium_Grip/0.jpg' },
  { key: 'incline', name: 'Press inclinado con mancuernas', nameEn: 'Incline Dumbbell Press', muscle: 'Pectorales', secondary: ['Hombros', 'Tríceps'], equipment: 'Mancuerna', force: 'push', startKg: 24, endKg: 34, imageUrl: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Incline_Dumbbell_Press/0.jpg' },
  { key: 'ohp', name: 'Press militar con barra', nameEn: 'Barbell Shoulder Press', muscle: 'Hombros', secondary: ['Tríceps', 'Trapecios'], equipment: 'Barra', force: 'push', startKg: 35, endKg: 50, imageUrl: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Shoulder_Press/0.jpg' },
  { key: 'row', name: 'Remo con barra', nameEn: 'Bent Over Barbell Row', muscle: 'Dorsales', secondary: ['Bíceps', 'Hombros'], equipment: 'Barra', force: 'pull', startKg: 55, endKg: 72.5, imageUrl: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Bent_Over_Barbell_Row/0.jpg' },
  { key: 'pulldown', name: 'Jalón al pecho agarre cerrado', nameEn: 'Close-Grip Front Lat Pulldown', muscle: 'Dorsales', secondary: ['Bíceps', 'Trapecios'], equipment: 'Polea', force: 'pull', startKg: 50, endKg: 67.5, imageUrl: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Close-Grip_Front_Lat_Pulldown/0.jpg' },
  { key: 'curl', name: 'Curl con barra', nameEn: 'Barbell Curl', muscle: 'Bíceps', secondary: ['Antebrazos'], equipment: 'Barra', force: 'pull', startKg: 20, endKg: 30, imageUrl: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Curl/0.jpg' },
  { key: 'squat', name: 'Sentadilla con barra', nameEn: 'Barbell Squat', muscle: 'Cuádriceps', secondary: ['Glúteos', 'Gemelos'], equipment: 'Barra', force: 'push', startKg: 70, endKg: 100, imageUrl: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Squat/0.jpg' },
  { key: 'deadlift', name: 'Peso muerto', nameEn: 'Barbell Deadlift', muscle: 'Zona lumbar', secondary: ['Glúteos', 'Isquiotibiales', 'Cuádriceps', 'Dorsales'], equipment: 'Barra', force: 'pull', startKg: 80, endKg: 120, imageUrl: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Deadlift/0.jpg' },
  { key: 'legpress', name: 'Prensa de piernas', nameEn: 'Leg Press', muscle: 'Cuádriceps', secondary: ['Glúteos', 'Isquiotibiales', 'Gemelos'], equipment: 'Máquina', force: 'push', startKg: 140, endKg: 210, imageUrl: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Leg_Press/0.jpg' },
  { key: 'lunge', name: 'Zancadas con mancuernas', nameEn: 'Dumbbell Lunges', muscle: 'Cuádriceps', secondary: ['Glúteos', 'Isquiotibiales', 'Gemelos'], equipment: 'Mancuerna', force: 'push', startKg: 14, endKg: 22, imageUrl: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Dumbbell_Lunges/0.jpg' },
  { key: 'calf', name: 'Prensa de gemelos', nameEn: 'Calf Press', muscle: 'Gemelos', secondary: ['Isquiotibiales'], equipment: 'Máquina', force: 'push', startKg: 90, endKg: 130, imageUrl: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Calf_Press/0.jpg' },
  { key: 'abwheel', name: 'Rueda abdominal', nameEn: 'Ab Roller', muscle: 'Abdominales', secondary: ['Hombros', 'Dorsales'], equipment: 'Otros', force: 'push', startKg: 10, endKg: 15, imageUrl: 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Ab_Roller/0.jpg' },
]

// UUIDs estables por ejercicio (coinciden entre datasets del demo).
const EX_UUIDS = [
  '11111111-1111-4111-8111-111111111101',
  '11111111-1111-4111-8111-111111111102',
  '11111111-1111-4111-8111-111111111103',
  '11111111-1111-4111-8111-111111111104',
  '11111111-1111-4111-8111-111111111105',
  '11111111-1111-4111-8111-111111111106',
  '11111111-1111-4111-8111-111111111107',
  '11111111-1111-4111-8111-111111111108',
  '11111111-1111-4111-8111-111111111109',
  '11111111-1111-4111-8111-11111111110a',
  '11111111-1111-4111-8111-11111111110b',
  '11111111-1111-4111-8111-11111111110c',
]

export function embeddedMuscles(): Muscle[] {
  return Object.values(M).map((m) => ({ ...m }))
}

export function embeddedEquipment(): Equipment[] {
  return Object.values(EQ).map((e) => ({ ...e }))
}

export function embeddedExercises(nowIso: string): Exercise[] {
  return EXERCISES.map((s, i) => ({
    id: EX_UUIDS[i],
    source_id: null,
    name: s.name,
    name_en: s.nameEn,
    description: null,
    instructions: null,
    instructions_es: null,
    muscle_primary: M[s.muscle].id,
    muscle_secondary: s.secondary.map((m) => M[m].id),
    equipment: EQ[s.equipment].id,
    category: 'fuerza',
    level: 'intermedio',
    force: s.force,
    image_url: s.imageUrl,
    created_at: nowIso,
  }))
}

interface DaySpec {
  routineKey: string
  routineName: string
  dayNumber: number
  dayName: string
  weekday: string
  goal: string
  exercises: string[]
}

const DAYS: DaySpec[] = [
  { routineKey: 'torso', routineName: 'Torso', dayNumber: 1, dayName: 'Torso A', weekday: 'lunes', goal: 'Empuje y tirón horizontal', exercises: ['bench', 'row', 'ohp', 'abwheel'] },
  { routineKey: 'pierna', routineName: 'Pierna', dayNumber: 1, dayName: 'Pierna A', weekday: 'martes', goal: 'Sentadilla y bisagra', exercises: ['squat', 'deadlift', 'calf'] },
  { routineKey: 'torso', routineName: 'Torso', dayNumber: 2, dayName: 'Torso B', weekday: 'jueves', goal: 'Empuje y tirón vertical', exercises: ['incline', 'pulldown', 'curl', 'ohp'] },
  { routineKey: 'pierna', routineName: 'Pierna', dayNumber: 2, dayName: 'Pierna B', weekday: 'viernes', goal: 'Prensa y zancada', exercises: ['legpress', 'lunge', 'calf', 'abwheel'] },
]

const WEEKDAY_INDEX: Record<string, number> = {
  domingo: 0, lunes: 1, martes: 2, miércoles: 3, jueves: 4, viernes: 5, sábado: 6,
}

const DELOAD_EVERY_DAYS = 42
const DELOAD_FACTOR = 0.8
const NOISE_KG = 2.5
const TOTAL_DAYS = 180

export interface DemoDataset {
  routines: Routine[]
  days: RoutineDay[]
  routineExercises: RoutineExercise[]
  sessions: Session[]
  sets: SessionSet[]
  metrics: BodyMetric[]
  profile: UserProfile
  exercises: Exercise[]
  muscles: Muscle[]
  equipment: Equipment[]
}

/**
 * Construye el dataset demo de 6 meses (180 días) para un userId.
 *
 * - 4 sesiones semanales (Lun Torso A, Mar Pierna A, Jue Torso B, Vie Pierna B).
 * - Progresión lineal por ejercicio con ruido ±2.5 kg y deload (×0.8) cada 42 días.
 * - Cero nulos: peso, reps, RPE y fechas (ISO8601 estricto via toISOString).
 */
export function buildDemoDataset(userId: string, now = new Date()): DemoDataset {
  const rng = mulberry32(0x564b5454)
  const start = new Date(now.getTime() - (TOTAL_DAYS - 1) * 86400000)
  start.setHours(12, 0, 0, 0)
  const startIso = start.toISOString()

  const exercises = embeddedExercises(startIso)
  const muscles = embeddedMuscles()
  const equipment = embeddedEquipment()
  const specByKey = new Map(EXERCISES.map((s) => [s.key, s]))

  // ---------- rutinas ----------
  const routineIdByKey = new Map<string, string>()
  const routines: Routine[] = []
  for (const key of ['torso', 'pierna']) {
    const id = uuidFromRng(rng)
    routineIdByKey.set(key, id)
    routines.push({
      id,
      user_id: userId,
      name: key === 'torso' ? 'Torso' : 'Pierna',
      description: '',
      created_at: startIso,
    })
  }

  // ---------- días + ejercicios de rutina ----------
  const days: RoutineDay[] = []
  const routineExercises: RoutineExercise[] = []
  const dayIdBySpec = new Map<DaySpec, string>()
  for (const spec of DAYS) {
    const dayId = uuidFromRng(rng)
    dayIdBySpec.set(spec, dayId)
    days.push({
      id: dayId,
      routine_id: routineIdByKey.get(spec.routineKey) as string,
      day_number: spec.dayNumber,
      name: spec.dayName,
      weekday: spec.weekday,
      goal: spec.goal,
    })
    spec.exercises.forEach((key, i) => {
      const exIndex = EXERCISES.findIndex((s) => s.key === key)
      routineExercises.push({
        id: uuidFromRng(rng),
        day_id: dayId,
        exercise_id: EX_UUIDS[exIndex],
        position: i,
        sets: key === 'deadlift' || key === 'squat' ? 4 : 3,
        reps: '8-12',
        rest_seconds: key === 'squat' || key === 'deadlift' ? 180 : 90,
        superset_group: null,
        notes: '',
      })
    })
  }

  // ---------- sesiones + series (progresión) ----------
  const sessions: Session[] = []
  const sets: SessionSet[] = []
  const sessionCountByKey = new Map<string, number>()

  for (let offset = TOTAL_DAYS - 1; offset >= 0; offset--) {
    const day = new Date(start.getTime() + offset * 86400000)
    const wd = day.getDay()
    const spec = DAYS.find((d) => WEEKDAY_INDEX[d.weekday] === wd)
    if (!spec) continue

    const sessionId = uuidFromRng(rng)
    const started = new Date(day)
    started.setHours(18, 30, 0, 0)
    const duration = 55 + Math.floor(rng() * 11)
    const ended = new Date(started.getTime() + duration * 60000)
    sessions.push({
      id: sessionId,
      user_id: userId,
      routine_id: routineIdByKey.get(spec.routineKey) as string,
      day_id: dayIdBySpec.get(spec) as string,
      started_at: started.toISOString(),
      ended_at: ended.toISOString(),
      duration_minutes: duration,
      feeling: 3 + Math.floor(rng() * 3),
      notes: '',
    })

    const inDeload = offset % DELOAD_EVERY_DAYS < 7
    spec.exercises.forEach((key) => {
      const specEx = specByKey.get(key) as ExerciseSpec
      const count = sessionCountByKey.get(key) ?? 0
      sessionCountByKey.set(key, count + 1)
      const totalFor = 25 + Math.floor((EXERCISES.indexOf(specEx) % 3) * 4)
      const progress = Math.min(1, count / totalFor)
      const base = specEx.startKg + (specEx.endKg - specEx.startKg) * progress
      const noise = (rng() * 2 - 1) * NOISE_KG
      const dayWeight = round((inDeload ? base * DELOAD_FACTOR : base) + noise)

      const setCount = spec.exercises.includes(key) && (key === 'squat' || key === 'deadlift') ? 4 : 3
      for (let s = 0; s < setCount; s++) {
        const scale = [0.96, 1.0, 1.04][s] ?? 1.0
        const reps = s === 0 ? 10 + Math.floor(rng() * 3) : s === 1 ? 8 + Math.floor(rng() * 3) : 6 + Math.floor(rng() * 3)
        sets.push({
          id: uuidFromRng(rng),
          session_id: sessionId,
          exercise_id: EX_UUIDS[EXERCISES.indexOf(specEx)],
          set_number: s + 1,
          weight_kg: round(dayWeight * scale),
          reps,
          rpe: 7 + Math.floor(rng() * 3),
          completed: true,
          notes: '',
        })
      }
    })
  }

  // ---------- medidas corporales (semanales) ----------
  const metrics: BodyMetric[] = []
  const weightDelta = 88 - 82.4
  for (let offset = TOTAL_DAYS - 1; offset >= 0; offset -= 7) {
    const day = new Date(start.getTime() + offset * 86400000)
    const progress = 1 - offset / TOTAL_DAYS
    metrics.push({
      id: uuidFromRng(rng),
      user_id: userId,
      date: day.toISOString().slice(0, 10),
      weight_kg: round(88 - weightDelta * progress + (rng() * 0.8 - 0.4), 0.1),
      notes: '',
    })
  }

  // ---------- perfil ----------
  const profile: UserProfile = {
    user_id: userId,
    height_cm: 178,
    age: 29,
    sex: 'male',
    level: 'intermedio',
    goal: 'ganar_masa',
    updated_at: now.toISOString(),
  }

  return {
    routines,
    days,
    routineExercises,
    sessions,
    sets,
    metrics,
    profile,
    exercises,
    muscles,
    equipment,
  }
}