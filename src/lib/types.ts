export interface Muscle {
  id: number
  name: string
  name_en?: string | null
  group_name: string
}

export interface Equipment {
  id: number
  name: string
  name_en?: string | null
  kind: string
}

export interface Exercise {
  id: string
  source_id: string | null
  name: string
  name_en: string | null
  description: string | null
  instructions: string[] | null
  instructions_es?: string[] | null
  muscle_primary: number | null
  muscle_secondary: number[] | null
  equipment: number | null
  category: string | null
  level: string | null
  force: string | null
  image_url: string | null
  created_at: string
}

export interface Routine {
  id: string
  user_id: string
  name: string
  description: string | null
  created_at: string
  days?: RoutineDay[]
}

export interface RoutineDay {
  id: string
  routine_id: string
  day_number: number
  name: string | null
  weekday: string | null
  goal: string | null
  exercises?: RoutineExercise[]
}

export interface RoutineExercise {
  id: string
  day_id: string
  exercise_id: string
  position: number
  sets: number
  reps: string | null
  rest_seconds: number
  superset_group: number | null
  notes: string | null
  exercise?: Exercise
}

export interface Session {
  id: string
  user_id: string
  routine_id: string | null
  day_id: string | null
  started_at: string
  ended_at: string | null
  duration_minutes: number | null
  feeling: number | null
  notes: string | null
  sets?: SessionSet[]
}

export interface SessionSet {
  id: string
  session_id: string
  exercise_id: string
  set_number: number
  weight_kg: number | null
  reps: number | null
  rpe: number | null
  completed: boolean
  notes: string | null
}

export interface BodyMetric {
  id: string
  user_id: string
  date: string
  weight_kg: number | null
  notes: string | null
}

export type Level = 'principiante' | 'intermedio' | 'avanzado'
export type Goal = 'perder_grasa' | 'ganar_masa' | 'mantener'
export type Sex = 'male' | 'female' | 'other'

export interface UserProfile {
  user_id: string
  height_cm: number | null
  age: number | null
  sex: Sex | null
  level: Level
  goal: Goal
  updated_at: string
}