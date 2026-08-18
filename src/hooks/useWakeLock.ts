import { useEffect } from 'react'

export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return
    let lock: WakeLockSentinel | null = null
    let disposed = false

    async function acquire() {
      try {
        if (!('wakeLock' in navigator)) return
        lock = await navigator.wakeLock.request('screen')
        lock.addEventListener('release', () => {
          lock = null
          if (!disposed) void acquire()
        })
      } catch {
        // no soportado o denegado: la sesión sigue sin bloqueo de pantalla
      }
    }

    void acquire()
    return () => {
      disposed = true
      lock?.release().catch(() => {})
    }
  }, [enabled])
}