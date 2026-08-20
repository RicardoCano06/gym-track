import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '@/lib/auth-context'
import { getPendingCount, subscribeSync } from '@/lib/sync'
import { useLang } from '@/lib/lang-context'

export default function HeaderStatus() {
  const { user } = useAuth()
  const { t } = useLang()
  const [pending, setPending] = useState(getPendingCount())
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const unsubscribe = subscribeSync(() => setPending(getPendingCount()))
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      unsubscribe()
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const initial = (user?.email?.trim().charAt(0) ?? 'U').toUpperCase()
  const dotClass = !online
    ? 'bg-amber-400'
    : pending > 0
      ? 'bg-sky-400'
      : 'bg-emerald-400'

  return (
    <NavLink
      to="/perfil"
      aria-label={t('header.goProfile')}
      title={t('header.profile')}
      className="relative flex h-9 w-9 items-center justify-center rounded-full border border-edge2 bg-surface2 text-sm font-semibold text-soft transition-all duration-200 hover:border-edge2 hover:text-strong active:scale-95"
    >
      {initial}
      <span
        aria-hidden
        className={`absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg ${dotClass}`}
      />
    </NavLink>
  )
}