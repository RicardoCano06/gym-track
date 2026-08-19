import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'

interface RestTimerValue {
  running: boolean
  remaining: number
  start: (seconds: number) => void
  extend: () => void
  stop: () => void
}

const RestTimerContext = createContext<RestTimerValue | null>(null)

function beep() {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.25, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    osc.start()
    osc.stop(ctx.currentTime + 0.4)
  } catch {
    // sin audio, no pasa nada
  }
}

function alertExpired() {
  beep()
  try {
    navigator.vibrate?.([200, 100, 200])
  } catch {
    // sin vibración, no pasa nada
  }
}

export function RestTimerProvider({ children }: { children: ReactNode }) {
  const [running, setRunning] = useState(false)
  const [remaining, setRemaining] = useState(0)
  const endAtRef = useRef(0)
  const rafRef = useRef(0)

  const computeRemaining = () =>
    Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000))

  const start = useCallback((seconds: number) => {
    endAtRef.current = Date.now() + seconds * 1000
    setRemaining(seconds)
    setRunning(true)
  }, [])

  const extend = useCallback(() => {
    endAtRef.current += 30000
    setRemaining(computeRemaining())
  }, [])

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    setRunning(false)
    setRemaining(0)
  }, [])

  useEffect(() => {
    if (!running) return
    const tick = () => {
      const left = computeRemaining()
      setRemaining(left)
      if (left <= 0) {
        alertExpired()
        setRunning(false)
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [running])

  useEffect(() => {
    if (!running) return
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      const left = computeRemaining()
      setRemaining(left)
      if (left <= 0) {
        alertExpired()
        setRunning(false)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [running])

  const value: RestTimerValue = { running, remaining, start, extend, stop }

  return (
    <RestTimerContext.Provider value={value}>{children}</RestTimerContext.Provider>
  )
}

export function useRestTimer() {
  const ctx = useContext(RestTimerContext)
  if (!ctx) throw new Error('useRestTimer debe usarse dentro de RestTimerProvider')
  return ctx
}
