import type { Goal, Level } from '@/lib/types'
import { messages } from '@/lib/i18n'
import type { Lang } from '@/lib/i18n'

export interface BMIResult {
  bmi: number
  category: 'bajo_peso' | 'normal' | 'sobrepeso' | 'obesidad'
}

const CATEGORY_KEYS: Record<BMIResult['category'], string> = {
  bajo_peso: 'rec.bmiLow',
  normal: 'rec.bmiNormal',
  sobrepeso: 'rec.bmiOver',
  obesidad: 'rec.bmiObese',
}

export function computeBMI(weightKg: number, heightCm: number): BMIResult {
  const heightM = heightCm / 100
  const bmi = weightKg / (heightM * heightM)
  let category: BMIResult['category']
  if (bmi < 18.5) category = 'bajo_peso'
  else if (bmi < 25) category = 'normal'
  else if (bmi < 30) category = 'sobrepeso'
  else category = 'obesidad'
  return { bmi, category }
}

export function bmiLabel(category: BMIResult['category'], lang: Lang): string {
  return messages[lang][CATEGORY_KEYS[category]] ?? messages.es[CATEGORY_KEYS[category]]
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

export function getRecommendations(
  input: RecommendationInput,
  lang: Lang,
): Recommendations {
  const m = messages[lang]
  const items: string[] = []

  if (input.bmi !== null) {
    if (input.bmi < 18.5) {
      items.push(m['rec.low.1'])
      items.push(m['rec.low.2'])
      items.push(m['rec.low.3'])
    } else if (input.bmi < 25) {
      items.push(m['rec.normal.1'])
      items.push(m['rec.normal.2'])
    } else if (input.bmi < 30) {
      items.push(m['rec.over.1'])
      items.push(m['rec.over.2'])
    } else {
      items.push(m['rec.obese.1'])
      items.push(m['rec.obese.2'])
    }
  }

  if (input.goal === 'perder_grasa') {
    items.push(m['rec.goalLose'])
  } else if (input.goal === 'ganar_masa') {
    items.push(m['rec.goalGain'])
  } else {
    items.push(m['rec.goalMaintain'])
  }

  if (input.level === 'principiante') {
    items.push(m['rec.levelLow'])
  } else if (input.level === 'intermedio') {
    items.push(m['rec.levelMid'])
  } else {
    items.push(m['rec.levelHigh'])
  }

  items.push(m['rec.rest48'])
  items.push(m['rec.track'])

  return { title: m['rec.title'], items }
}