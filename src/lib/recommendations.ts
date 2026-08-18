import type { Goal, Level } from '@/lib/types'

export interface BMIResult {
  bmi: number
  category: 'bajo_peso' | 'normal' | 'sobrepeso' | 'obesidad'
  label: string
}

const LABELS: Record<BMIResult['category'], string> = {
  bajo_peso: 'Bajo peso',
  normal: 'Peso normal',
  sobrepeso: 'Sobrepeso',
  obesidad: 'Obesidad',
}

export function computeBMI(weightKg: number, heightCm: number): BMIResult {
  const heightM = heightCm / 100
  const bmi = weightKg / (heightM * heightM)
  let category: BMIResult['category']
  if (bmi < 18.5) category = 'bajo_peso'
  else if (bmi < 25) category = 'normal'
  else if (bmi < 30) category = 'sobrepeso'
  else category = 'obesidad'
  return { bmi, category, label: LABELS[category] }
}

export interface RecommendationInput {
  bmi: number | null
  level: Level
  goal: Goal
}

export interface Recommendations {
  title: string
  items: string[]
}

export function getRecommendations(input: RecommendationInput): Recommendations {
  const items: string[] = []

  if (input.bmi !== null) {
    if (input.bmi < 18.5) {
      items.push(
        'Entrená fuerza 2-3 veces por semana con movimientos compuestos (sentadilla, press, remo, peso muerto).',
      )
      items.push('Cardio suave 1-2 veces por semana, sin descuidar la recuperación.')
      items.push('Buscá un superávit calórico moderado y proteína de 1.6-2.2 g por kg de peso para ganar masa.')
    } else if (input.bmi < 25) {
      items.push(
        'Rutina balanceada: 3-4 días de fuerza a la semana + 2 días de cardio moderado.',
      )
      items.push('Mantené la sobrecarga progresiva (aumentar peso o reps de forma gradual) para seguir mejorando.')
    } else if (input.bmi < 30) {
      items.push(
        'Fuerza 3-4 días por semana priorizando músculos grandes (pierna, espalda, pecho) para maximizar el gasto calórico.',
      )
      items.push('Sumá 2-3 sesiones de cardio (150-300 min/semana) y un déficit calórico moderado de 300-500 kcal/día.')
    } else {
      items.push(
        'Arrancá con 2-3 días de fuerza con cargas livianas y 3-5 caminatas por semana (30-60 min).',
      )
      items.push('Consultá a un médico antes de empezar y avanzá de forma gradual, priorizando la consistencia.')
    }
  }

  if (input.goal === 'perder_grasa') {
    items.push(
      'Déficit moderado (300-500 kcal/día) y proteína alta (1.6-2.2 g/kg) para proteger la masa muscular.',
    )
  } else if (input.goal === 'ganar_masa') {
    items.push('Superávit leve (200-300 kcal/día), proteína de 1.6-2.2 g/kg y foco en 6-12 repeticiones con carga desafiante.')
  } else {
    items.push('Mantené el equilibrio energético y movete al menos 150 minutos por semana.')
  }

  if (input.level === 'principiante') {
    items.push('Empezá con 6-10 series semanales por grupo muscular y aumentá el volumen de forma gradual.')
  } else if (input.level === 'intermedio') {
    items.push('Apuntá a 10-16 series semanales por grupo muscular: al menos 10 series es el mínimo óptimo para hipertrofia.')
  } else {
    items.push('Manejá 10-20 series semanales por grupo con periodización y control de la fatiga (RPE).')
  }

  items.push('Respetá al menos 48 h de descanso entre sesiones del mismo grupo muscular.')
  items.push('Registrá tus sesiones en GymTrack para controlar el volumen semanal y la progresión de cargas.')

  return { title: 'Recomendaciones para tu entrenamiento', items }
}