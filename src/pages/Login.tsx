import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'

export default function Login() {
  const { user, loading } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-edge2 border-t-emerald-500" />
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
        if (error) setError(translateError(error.message))
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) setError(translateError(error.message))
        else
          setMessage(
            'Cuenta creada. Si la confirmación de email está activada, revisá tu casilla para verificar y luego iniciá sesión.',
          )
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg px-4">
      <div className="mb-8 flex items-center gap-2 text-2xl font-bold">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 font-black text-neutral-950">
          G
        </span>
        <span>GymTrack</span>
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-edge bg-surface p-6">
        <div className="mb-6 grid grid-cols-2 rounded-lg bg-surface2 p-1 text-sm font-medium">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m)
                setError(null)
                setMessage(null)
              }}
              className={`rounded-md py-2 transition-colors ${
                mode === m ? 'bg-bg text-strong' : 'text-dim hover:text-high'
              }`}
            >
              {m === 'login' ? 'Ingresar' : 'Registrarse'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm text-dim">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-edge2 bg-bg px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-dim3 focus:border-emerald-500"
              placeholder="tu@email.com"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm text-dim">Contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-edge2 bg-bg px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-dim3 focus:border-emerald-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
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
            className="w-full rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-neutral-950 transition-colors hover:bg-emerald-400 disabled:opacity-60"
          >
            {submitting ? 'Un momento...' : mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </div>
  )
}

function translateError(message: string): string {
  if (message.toLowerCase().includes('invalid login credentials'))
    return 'Email o contraseña incorrectos'
  if (message.toLowerCase().includes('email not confirmed'))
    return 'Email no confirmado. Revisá tu casilla de correo'
  if (message.toLowerCase().includes('already registered'))
    return 'Ese email ya está registrado. Probá ingresar'
  if (message.toLowerCase().includes('password should be at least'))
    return 'La contraseña debe tener al menos 6 caracteres'
  return message
}