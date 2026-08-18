import { useEffect, useState } from 'react'
import { getPendingCount, subscribeSync } from '@/lib/sync'

export default function SyncStatus() {
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

  if (online && pending === 0) return null

  const label = !online
    ? `Sin conexión${pending > 0 ? ` · ${pending} pendiente${pending === 1 ? '' : 's'}` : ''}`
    : `Sincronizando · ${pending} pendiente${pending === 1 ? '' : 's'}`

  return (
    <span
      className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
        !online
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
          : 'border-sky-500/40 bg-sky-500/10 text-sky-400'
      }`}
    >
      {!online ? '⚠' : '⏳'} {label}
    </span>
  )
}