import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { AuthContext } from '@/lib/auth-context'
import {
  DEMO_EMAIL,
  getLocalDemoUser,
  isLocalDemoMode,
  purgeDemoLocal,
  setDemoMode,
} from '@/lib/demo'
import { DEMO_LOCAL_EVENT, SESSION_CLEARED_EVENT } from '@/lib/auth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      const session = data.session
      if (session?.user) {
        setDemoMode(session.user.email === DEMO_EMAIL)
        setUser(session.user)
      } else if (isLocalDemoMode()) {
        // Fallback "Demo Puramente Local" (Supabase inaccesible): sesión
        // sintética para que la app renderice con datos 100% locales.
        setUser(getLocalDemoUser())
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          setDemoMode(session.user.email === DEMO_EMAIL)
          setUser(session.user)
        }
      } else if (event === 'SIGNED_OUT') {
        if (isLocalDemoMode()) {
          // cierre de sesión local: se purga todo y se limpia el flag
          void purgeDemoLocal().then(() => setDemoMode(false))
        }
        setUser(null)
      }
      setLoading(false)
    })

    const onDemoLocal = () => setUser(getLocalDemoUser())
    const onSessionCleared = () => setUser(null)
    window.addEventListener(DEMO_LOCAL_EVENT, onDemoLocal)
    window.addEventListener(SESSION_CLEARED_EVENT, onSessionCleared)

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
      window.removeEventListener(DEMO_LOCAL_EVENT, onDemoLocal)
      window.removeEventListener(SESSION_CLEARED_EVENT, onSessionCleared)
    }
  }, [])

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>
}