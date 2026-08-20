import { useEffect, useState } from 'react'
import { getPendingCount, isSyncPaused, subscribeSync } from '@/lib/sync'
import { useLang } from '@/lib/lang-context'

export default function SyncStatus() {
  const [pending, setPending] = useState(getPendingCount())
  const [paused, setPaused] = useState(isSyncPaused())
  const [online, setOnline] = useState(() => navigator.onLine)
  const { t } = useLang()

  useEffect(() => {
    const unsubscribe = subscribeSync(() => {
      setPending(getPendingCount())
      setPaused(isSyncPaused())
    })
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

  if (online && !paused && pending === 0) return null

  const pendingText = pending > 0 ? t('sync.pendingCount', { text: t('sync.pending', { n: pending }) }) : ''

  const label = !online
    ? `${t('sync.offline')}${pendingText}`
    : paused && pending > 0
      ? `${t('sync.paused')}${pendingText}`
      : `${t('sync.syncing')}${pendingText}`

  return (
    <span
      className={`glass rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
        !online
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
          : paused && pending > 0
            ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
            : 'border-sky-500/40 bg-sky-500/10 text-sky-400'
      }`}
    >
      {!online ? '⚠' : paused && pending > 0 ? '🔒' : '⏳'} {label}
    </span>
  )
}