import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '@/lib/auth-context'
import { supabase } from '@/lib/supabase'
import { useConfirm } from '@/lib/use-confirm'
import {
  fetchBodyMetrics,
  fetchUserProfile,
  saveBodyMetric,
  saveUserProfile,
} from '@/lib/db'
import { computeBMI, bmiLabel, getRecommendations } from '@/lib/recommendations'
import type { BMIResult } from '@/lib/recommendations'
import type { BodyMetric, Goal, Level, Sex, UserProfile } from '@/lib/types'
import { useLang } from '@/lib/lang-context'
import ThemeToggle from '@/components/ThemeToggle'
import LanguageToggle from '@/components/LanguageToggle'

const LEVELS: Level[] = ['principiante', 'intermedio', 'avanzado']
const GOALS: Goal[] = ['perder_grasa', 'ganar_masa', 'mantener']

const LEVEL_KEYS: Record<Level, string> = {
  principiante: 'profile.levelPrincipiante',
  intermedio: 'profile.levelIntermedio',
  avanzado: 'profile.levelAvanzado',
}

const GOAL_KEYS: Record<Goal, string> = {
  perder_grasa: 'profile.goalLose',
  ganar_masa: 'profile.goalGain',
  mantener: 'profile.goalMaintain',
}

const CATEGORY_STYLES: Record<BMIResult['category'], string> = {
  bajo_peso: 'border-sky-500/30 bg-sky-500/10 text-sky-400',
  normal: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  sobrepeso: 'border-amber-500/30 bg-amber-500/10 text-amber-400',
  obesidad: 'border-red-500/30 bg-red-500/10 text-red-400',
}

export default function Profile() {
  const { user } = useAuth()
  const { ask, dialog } = useConfirm()
  const { lang, t } = useLang()
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
    return getRecommendations(
      {
        bmi: bmi?.bmi ?? null,
        level: effectiveLevel,
        goal: effectiveGoal,
      },
      lang,
    )
  }, [bmi, profile, level, goal, lang])

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault()
    if (!user || profileSaving) return
    setProfileError(null)
    setProfileSaved(false)

    const heightNum = parseFloat(height.replace(',', '.'))
    if (Number.isNaN(heightNum) || heightNum < 100 || heightNum > 250) {
      setProfileError(t('profile.heightError'))
      return
    }
    let ageNum: number | null = null
    if (age.trim()) {
      ageNum = parseInt(age, 10)
      if (Number.isNaN(ageNum) || ageNum < 10 || ageNum > 120) {
        setProfileError(t('profile.ageError'))
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
      setProfileError(t('profile.saveError'))
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
      setWeightError(t('profile.weightError'))
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
      setWeightError(t('profile.weightSaveError'))
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
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('profile.title')}</h1>
          <p className="mt-1 text-sm text-dim">{t('profile.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <section className="card-hairline glass-card rounded-2xl p-5">
            <h2 className="mb-4 font-semibold">{t('profile.data')}</h2>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm text-dim">{t('profile.height')}</label>
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
                  <label className="mb-1.5 block text-sm text-dim">{t('profile.age')}</label>
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
                <label className="mb-1.5 block text-sm text-dim">{t('profile.sex')}</label>
                <select
                  value={sex}
                  onChange={(e) => setSex(e.target.value as Sex | '')}
                  className="w-full rounded-lg border border-edge2 bg-bg px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-500"
                >
                  <option value="">{t('profile.sexUndefined')}</option>
                  <option value="male">{t('profile.male')}</option>
                  <option value="female">{t('profile.female')}</option>
                  <option value="other">{t('profile.other')}</option>
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-dim">{t('profile.level')}</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value as Level)}
                  className="w-full rounded-lg border border-edge2 bg-bg px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-500"
                >
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {t(LEVEL_KEYS[l])}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-sm text-dim">{t('profile.goal')}</label>
                <select
                  value={goal}
                  onChange={(e) => setGoal(e.target.value as Goal)}
                  className="w-full rounded-lg border border-edge2 bg-bg px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-emerald-500"
                >
                  {GOALS.map((g) => (
                    <option key={g} value={g}>
                      {t(GOAL_KEYS[g])}
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
                  {t('profile.saved')}
                </p>
              )}

              <button
                type="submit"
                disabled={profileSaving}
                className="w-full rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-400 disabled:opacity-60"
              >
                {profileSaving ? t('profile.saving') : t('profile.save')}
              </button>
            </form>
          </section>

          <section className="card-hairline glass-card rounded-2xl p-5">
            <h2 className="mb-1 font-semibold">{t('profile.weight')}</h2>
            <p className="mb-4 text-sm text-dim">{t('profile.weightHint')}</p>
            <form onSubmit={handleSaveWeight} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-dim">{t('profile.weightKg')}</label>
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
                <label className="mb-1.5 block text-sm text-dim">{t('profile.note')}</label>
                <input
                  type="text"
                  value={weightNotes}
                  onChange={(e) => setWeightNotes(e.target.value)}
                  placeholder={t('profile.notePlaceholder')}
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
                {weightSaving ? t('profile.saving') : t('profile.saveWeight')}
              </button>
            </form>
          </section>
        </div>

        <div className="space-y-4">
          <section className="card-hairline glass-card rounded-2xl p-5">
            <h2 className="mb-4 font-semibold">{t('profile.bmi')}</h2>
            {bmi ? (
              <>
                <div className="flex items-end gap-3">
                  <span className="font-mono text-4xl font-bold tracking-tight tabular-nums">
                    {bmi.bmi.toFixed(1)}
                  </span>
                  <span
                    className={`mb-1 rounded-full border px-3 py-1 text-sm font-medium ${CATEGORY_STYLES[bmi.category]}`}
                  >
                    {bmiLabel(bmi.category, lang)}
                  </span>
                </div>
                <BmiScale bmi={bmi.bmi} />
                <p className="mt-2 text-xs text-dim2">
                  {t('profile.lastWeight', {
                    weight: String(metrics[0]?.weight_kg ?? '—'),
                    date: formatDate(metrics[0]?.date, lang),
                  })}
                </p>
              </>
            ) : (
              <p className="text-sm text-dim">{t('profile.bmiHint')}</p>
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
            <h2 className="mb-4 font-semibold">{t('profile.weightHistory')}</h2>
            {metrics.length === 0 ? (
              <p className="text-sm text-dim">{t('profile.noWeights')}</p>
            ) : (
              <>
                <WeightSparkline metrics={metrics} lang={lang} />
                <div className="mt-4 divide-y divide-edge">
                  {metrics.slice(0, 14).map((m) => (
                    <div key={m.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-dim">{formatDate(m.date, lang)}</span>
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
          onClick={() =>
            ask({
              title: t('profile.logoutTitle'),
              message: t('profile.logoutMessage'),
              confirmLabel: t('profile.logout'),
              danger: true,
              onConfirm: async () => {
                await supabase.auth.signOut()
              },
            })
          }
          className="min-h-12 w-full rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-400 transition-all duration-200 hover:bg-red-500/20 active:scale-[0.99] md:hidden"
        >
          {t('profile.logout')}
        </button>
      </div>
      {dialog}
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

function WeightSparkline({
  metrics,
  lang,
}: {
  metrics: BodyMetric[]
  lang: 'es' | 'en'
}) {
  const t = useLang().t
  const points = metrics
    .slice()
    .reverse()
    .filter((m): m is BodyMetric & { weight_kg: number } => m.weight_kg !== null)
    .slice(-14)

  if (points.length < 2) {
    return <p className="text-sm text-dim">{t('profile.minWeights')}</p>
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
          {formatDate(points[0].date, lang)} · {points[0].weight_kg} kg
        </span>
        <span>
          {points[points.length - 1].weight_kg} kg · {formatDate(points[points.length - 1].date, lang)}
        </span>
      </div>
    </div>
  )
}

function formatDate(date: string | undefined, lang: 'es' | 'en'): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString(lang === 'en' ? 'en-US' : 'es-AR', {
    day: 'numeric',
    month: 'short',
  })
}