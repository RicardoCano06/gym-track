import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { useLang } from '@/lib/lang-context'
import { DEMO_EMAIL, DEMO_PASSWORD, enterLocalDemo, purgeDemoLocal } from '@/lib/demo'
import { resetDemoData } from '@/lib/demoData'
import { DEMO_LOCAL_EVENT } from '@/lib/auth'

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-[18px] w-[18px]"
    >
      {children}
    </svg>
  )
}

const EnvelopeIcon = (
  <Icon>
    <path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
    <path d="m22 6-10 7L2 6" />
  </Icon>
)

const LockIcon = (
  <Icon>
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </Icon>
)

const EyeIcon = (
  <Icon>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
)

const EyeSlashIcon = (
  <Icon>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </Icon>
)

export default function Login() {
  const { user, loading } = useAuth()
  const { t } = useLang()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-neutral-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-800 border-t-emerald-500" />
      </div>
    )
  }

  if (user) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setSubmitting(true)
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) setError(translateError(error.message, t))
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) setError(translateError(error.message, t))
        else setMessage(t('login.accountCreated'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Acceso Demo Sandbox (1-Click):
  //   1) Purga local (incluye deleteDatabase('vekt-local')) -> lienzo en blanco.
  //   2) Sign-in con la cuenta demo estática.
  //   3) Fallback: si Supabase está inaccesible, modo "Demo Puramente Local".
  async function handleDemo() {
    setError(null)
    setMessage(null)
    setSubmitting(true)
    await purgeDemoLocal()
    resetDemoData()
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      })
      if (error) throw error
    } catch {
      enterLocalDemo()
      window.dispatchEvent(new CustomEvent(DEMO_LOCAL_EVENT))
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'h-11 w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3.5 pl-10 font-mono text-sm text-white outline-none transition-colors duration-200 placeholder:text-neutral-600 focus:border-emerald-500/50'

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-neutral-950 px-5 py-8">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-7 animate-rise">
          <div className="flex items-center gap-2.5">
            <img src="/logo-vekt.png" alt="" aria-hidden className="h-[28px] w-auto" />
            <img src="/letras-vekt-white.png" alt="Vekt" className="h-10 w-auto" />
          </div>
          <p className="mt-3 text-sm text-neutral-400">{t('login.tagline')}</p>
        </div>

        <div className="relative mb-6 flex rounded-lg bg-neutral-900 p-1">
          <span
            aria-hidden
            className={`absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-md bg-neutral-800 transition-transform duration-300 ease-out ${
              mode === 'register' ? 'translate-x-full' : ''
            }`}
          />
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m)
                setError(null)
                setMessage(null)
              }}
              className={`relative z-10 flex-1 rounded-md py-2 text-sm transition-colors duration-200 ${
                mode === m ? 'font-medium text-white' : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              {m === 'login' ? t('login.signIn') : t('login.signUp')}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm text-neutral-500">
              {t('login.email')}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
                {EnvelopeIcon}
              </span>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="tu@email.com"
                autoComplete="email"
              />
            </div>
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm text-neutral-500">
              {t('login.password')}
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">
                {LockIcon}
              </span>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`${inputClass} pr-12`}
                placeholder="••••••••"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                aria-pressed={showPassword}
                className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-neutral-500 transition-colors hover:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-700"
              >
                {showPassword ? EyeSlashIcon : EyeIcon}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}
          {message && (
            <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="min-h-12 w-full rounded-lg bg-emerald-500 text-sm font-semibold text-neutral-950 transition-opacity duration-200 hover:opacity-90 active:opacity-80 disabled:opacity-50"
          >
            {submitting ? t('dialog.busy') : mode === 'login' ? t('login.signIn') : t('login.createAccount')}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-neutral-800" />
          <span className="text-xs text-neutral-600">o</span>
          <span className="h-px flex-1 bg-neutral-800" />
        </div>

        <button
          type="button"
          data-testid="demo-login"
          disabled={submitting}
          onClick={handleDemo}
          className="min-h-12 w-full rounded-lg border border-neutral-700 bg-neutral-900 text-sm font-semibold text-neutral-200 transition-colors duration-200 hover:border-emerald-500/50 hover:text-white active:opacity-80 disabled:opacity-50"
        >
          <span className="flex items-center justify-center gap-2">
            ⚡ {t('login.demo')}
          </span>
        </button>
        <p className="mt-2 text-center text-xs text-neutral-600">{t('login.demoHint')}</p>
      </div>
    </div>
  )
}

function translateError(
  message: string,
  t: (key: string) => string,
): string {
  if (message.toLowerCase().includes('invalid login credentials'))
    return t('login.err.invalidCredentials')
  if (message.toLowerCase().includes('email not confirmed'))
    return t('login.err.emailNotConfirmed')
  if (message.toLowerCase().includes('already registered'))
    return t('login.err.alreadyRegistered')
  if (message.toLowerCase().includes('password should be at least'))
    return t('login.err.passwordShort')
  return message
}