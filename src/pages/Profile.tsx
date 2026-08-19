import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import {
  fetchBodyMetrics,
  fetchUserProfile,
  saveBodyMetric,
  saveUserProfile,
} from '@/lib/db'
import { computeBMI, getRecommendations } from '@/lib/recommendations'
import type { BMIResult } from '@/lib/recommendations'
import type { BodyMetric, Goal, Level, Sex, UserProfile } from '@/lib/types'

const LEVELS: Level[] = ['principiante', 'intermedio', 'avanzado']
const GOALS: Goal[] = ['perder_grasa', 'ganar_masa', 'mantener']

const LEVEL_LABELS: Record<Level, string> = {
  principiante: 'Principiante',
  intermedio: 'Intermedio',
  avanzado: 'Avanzado',
}

const GOAL_LABELS: Record<Goal, string> = {
  perder_grasa: 'Perder grasa',
  ganar_masa: 'Ganar masa muscular',
  mantener: 'Mantener',
}

const CATEGORY_STYLES: Record<BMIResult['category'], string> = {
  bajo_peso: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  normal: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  sobrepeso: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  obesidad: 'border-red-500/30 bg-red-500/10 text-red-400',
}

export default function Profile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [metrics, setMetrics] = useState<BodyMetric[]>([])
  const [loading, setLoading] = useState(true)

  const [height, setHeight] = useState('')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState<Sex | ''>('')
  const [level, setLevel] = useState<Level>('principiante')
  const [goal, setGoal] = useState<Goal>('mantener')
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSaved, setProfileSaved] = useState(false)

  const [weight, setWeight] = useState('')
  const [weightNotes, setWeightNotes] = useState('')
  const [weightSaving, setWeightSaving] = useState(false)
  const [weightError, setWeightError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    Promise.all([fetchUserProfile(user.id), fetchBodyMetrics(user.id)])
      .then(([p, m]) => {
        setProfile(p)
        setMetrics(m)
        if (p) {
          setHeight(p.height_cm?.toString() ?? '')
          setAge(p.age?.toString() ?? '')
          setSex(p.sex ?? '')
          setLevel(p.level)
          setGoal(p.goal)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  const bmi = useMemo(() => {
    if (!profile?.height_cm) return null
    const latest = metrics[0]
    if (!latest?.weight_kg) return null
    return computeBMI(latest.weight_kg, profile.height_cm)
  }, [profile, metrics])

  const recommendations = useMemo(() => {
    const effectiveLevel = profile?.level ?? level
    const effectiveGoal = profile?.goal ?? goal
    return getRecommendations({
      bmi: bmi?.bmi ?? null,
      level: effectiveLevel,
      goal: effectiveGoal,
    })
  }, [bmi, profile, level, goal])

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault()
    if (!user || profileSaving) return
    setProfileError(null)
    setProfileSaved(false)

    const heightNum = parseFloat(height.replace(',', '.'))
    if (Number.isNaN(heightNum) || heightNum < 100 || heightNum > 250) {
      setProfileError('La altura debe estar entre 100 y 250 cm')
      return
    }
    let ageNum: number | null = null
    if (age.trim()) {
      ageNum = parseInt(age, 10)
      if (Number.isNaN(ageNum) || ageNum < 10 || ageNum > 120) {
        setProfileError('La edad debe estar entre 10 y 120 años')
        return
      }
    }

    setProfileSaving(true)
    try {
      const saved = await saveUserProfile(user.id, {
        height_cm: heightNum,
        age: ageNum,
        sex: sex || null,
        level,
        goal,
      })
      setProfile(saved)
      setProfileSaved(true)
    } catch (err) {
      console.error(err)
      setProfileError('No se pudo guardar el perfil. Probá de nuevo.')
    } finally {
      setProfileSaving(false)
    }
  }

  async function handleSaveWeight(e: FormEvent) {
    e.preventDefault()
    if (!user || weightSaving) return
    setWeightError(null)

    const weightNum = parseFloat(weight.replace(',', '.'))
    if (Number.isNaN(weightNum) || weightNum <= 0 || weightNum > 500) {
      setWeightError('Ingresá un peso válido (en kg)')
      return
    }

    setWeightSaving(true)
    try {
      const saved = await saveBodyMetric(user.id, weightNum, weightNotes.trim() || undefined)
      setMetrics((prev) => [
        saved,
        ...prev.filter((m) => m.date !== saved.date),
      ])
      setWeight('')
      setWeightNotes('')
    } catch (err) {
      console.error(err)
      setWeightError('No se pudo registrar el peso. Probá de nuevo.')
    } finally {
      setWeightSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="shimmer h-40 rounded-2xl border border-edge bg-surface" />
        ))}
      </div>
    )
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Perfil</h1>
        <p className="mt-1 text-sm text-dim">
          Tus datos corporales y recomendaciones de entrenamiento
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <section className="card-hairline glass-card rounded-2xl p-5">
            <h2 className="mb-4 font-semibold">Datos del perfil</h2>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm text-dim">Altura (cm)</label>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min={100}
                    max={250}
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="175"
                    className="w-full rounded-xl border border-edge2 bg-bg px-3.5 py-2.5 text-sm outline-none transition-all duration-200 placeholder:text-dim3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm text-dim">Edad</label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={10}
                    max={120}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    placeholder="28"
                    className="w-full rounded-xl border border-edge2 bg-bg px-3.5 py-2.5 text-sm outline-none transition-all duration-200 placeholder:text-dim3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-dim">Sexo</label>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value as Sex | '')}
                  className="w-full rounded-lg border border-edge2 bg-bg px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-500"
                >
                  <option value="">Prefiero no decirlo</option>
                  <option value="male">Masculino</option>
                  <option value="female">Femenino</option>
                  <option value="other">Otro</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-dim">Nivel de experiencia</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as Level)}
                  className="w-full rounded-lg border border-edge2 bg-bg px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-500"
                >
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {LEVEL_LABELS[l]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-dim">Objetivo</label>
                <select
                  value={goal}
                  onChange={(e) => setGoal(e.target.value as Goal)}
                  className="w-full rounded-lg border border-edge2 bg-bg px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-500"
                >
                  {GOALS.map((g) => (
                    <option key={g} value={g}>
                      {GOAL_LABELS[g]}
                    </option>
                  ))}
                </select>
              </div>

              {profileError && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {profileError}
                </p>
              )}
              {profileSaved && (
                <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
                  Perfil guardado
                </p>
              )}

              <button
                type="submit"
                disabled={profileSaving}
                className="w-full rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-400 disabled:opacity-60"
              >
                {profileSaving ? 'Guardando...' : 'Guardar perfil'}
              </button>
            </form>
          </section>

          <section className="card-hairline glass-card rounded-2xl p-5">
            <h2 className="mb-1 font-semibold">Registrar peso</h2>
            <p className="mb-4 text-sm text-dim">
              Registrá tu peso hoy para calcular tu IMC y seguir tu evolución
            </p>
            <form onSubmit={handleSaveWeight} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-dim">Peso (kg)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min={1}
                  max={500}
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  placeholder="80.5"
                  required
                  className="w-full rounded-xl border border-edge2 bg-bg px-3.5 py-2.5 text-sm outline-none transition-all duration-200 placeholder:text-dim3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-dim">Nota (opcional)</label>
                <input
                  type="text"
                  value={weightNotes}
                  onChange={(e) => setWeightNotes(e.target.value)}
                  placeholder="Ej: pesado por la mañana"
                  className="w-full rounded-xl border border-edge2 bg-bg px-3.5 py-2.5 text-sm outline-none transition-all duration-200 placeholder:text-dim3 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              {weightError && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                  {weightError}
                </p>
              )}

              <button
                type="submit"
                disabled={weightSaving || !weight.trim()}
                className="w-full rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-400 disabled:opacity-50"
              >
                {weightSaving ? 'Guardando...' : 'Registrar peso de hoy'}
              </button>
            </form>
          </section>
        </div>

        <div className="space-y-4">
          <section className="card-hairline glass-card rounded-2xl p-5">
            <h2 className="mb-4 font-semibold">Tu IMC</h2>
            {bmi ? (
              <>
                <div className="flex items-end gap-3">
                  <span className="font-mono text-4xl font-bold tracking-tight tabular-nums">
                    {bmi.bmi.toFixed(1)}
                  </span>
                  <span
                    className={`mb-1 rounded-full border px-3 py-1 text-sm font-medium ${CATEGORY_STYLES[bmi.category]}`}
                  >
                    {bmi.label}
                  </span>
                </div>
                <BmiScale bmi={bmi.bmi} />
                <p className="mt-2 text-xs text-dim2">
                  Último peso registrado: {metrics[0]?.weight_kg} kg el{' '}
                  {formatDate(metrics[0]?.date)}
                </p>
              </>
            ) : (
              <p className="text-sm text-dim">
                Completá tu altura en el perfil y registrá al menos un peso para calcular tu IMC.
              </p>
            )}
          </section>

          <section className="card-hairline glass-card rounded-2xl p-5">
            <h2 className="mb-3 font-semibold">{recommendations.title}</h2>
            <ul className="space-y-2.5">
              {recommendations.items.map((item, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-soft">
                  <span className="mt-0.5 text-emerald-500">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card-hairline glass-card rounded-2xl p-5">
            <h2 className="mb-4 font-semibold">Historial de peso</h2>
            {metrics.length === 0 ? (
              <p className="text-sm text-dim">
                Todavía no registraste pesos. Registrá tu primer peso arriba.
              </p>
            ) : (
              <>
                <WeightSparkline metrics={metrics} />
                <div className="mt-4 divide-y divide-edge">
                  {metrics.slice(0, 14).map((m) => (
                    <div key={m.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-dim">{formatDate(m.date)}</span>
                      <span className="font-mono font-medium tabular-nums">{m.weight_kg} kg</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      <div className="mt-8 border-t border-edge pt-6">
        <button
          onClick={() => supabase.auth.signOut()}
          className="min-h-12 w-full rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-400 transition-all duration-200 hover:bg-red-500/20 active:scale-[0.99] md:hidden"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

function BmiScale({ bmi }: { bmi: number }) {
  const MIN = 14
  const MAX = 40
  const pos = Math.min(100, Math.max(0, ((bmi - MIN) / (MAX - MIN)) * 100))
  return (
    <div className="mt-4">
      <div
        className="relative h-2 rounded-full"
        style={{
          backgroundImage:
            'linear-gradient(to right, #0ea5e9 0%, #0ea5e9 17.3%, #10b981 17.3%, #10b981 42.3%, #f59e0b 42.3%, #f59e0b 61.5%, #ef4444 61.5%, #ef4444 100%)',
        }}
      >
        <div
          className="absolute -top-1 h-4 w-1.5 rounded-full bg-white shadow"
          style={{ left: `calc(${pos}% - 3px)` }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-dim2">
        <span>14</span>
        <span className="text-sky-400">18.5</span>
        <span className="text-emerald-400">25</span>
        <span className="text-amber-400">30</span>
        <span>40</span>
      </div>
    </div>
  )
}

function WeightSparkline({ metrics }: { metrics: BodyMetric[] }) {
  const points = metrics
    .slice()
    .reverse()
    .filter((m): m is BodyMetric & { weight_kg: number } => m.weight_kg !== null)
    .slice(-14)

  if (points.length < 2) {
    return (
      <p className="text-sm text-dim">
        Registrá al menos 2 pesos para ver tu evolución.
      </p>
    )
  }

  const weights = points.map((p) => p.weight_kg)
  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const span = max - min || 1
  const W = 280
  const H = 64
  const coords = points.map((p, i) => {
    const x = points.length === 1 ? W / 2 : (i / (points.length - 1)) * W
    const y = H - 6 - ((p.weight_kg - min) / span) * (H - 12)
    return [x, y] as const
  })

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <polyline points={coords.map(([x, y]) => `${x},${y}`).join(' ')} className="fill-none stroke-emerald-500" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        {coords.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={2.5} className="fill-emerald-500" />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-dim2">
        <span>
          {formatDate(points[0].date)} · {points[0].weight_kg} kg
        </span>
        <span>
          {points[points.length - 1].weight_kg} kg · {formatDate(points[points.length - 1].date)}
        </span>
      </div>
    </div>
  )
}

function formatDate(date: string | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}