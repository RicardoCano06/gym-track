import { useEffect, useRef, useState } from 'react'

const QUICK_OPTIONS = [60, 90, 120, 180]

// Estado compartido a nivel módulo: el temporizador puede moverse de lugar
// dentro de la página (junto a la fila activa) sin perder el descanso en curso.
let sharedEndAt = 0
let sharedRunning = false

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

export default function RestTimer() {
  const [running, setRunningState] = useState(sharedRunning)
  const [remaining, setRemaining] = useState(() =>
    sharedRunning ? Math.max(0, Math.ceil((sharedEndAt - Date.now()) / 1000)) : 0,
  )
  const endAtRef = useRef(sharedEndAt)

  const computeRemaining = () =>
    Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000))

  const setRunning = (value: boolean) => {
    // eslint-disable-next-line react/globals
    sharedRunning = value
    setRunningState(value)
  }

  useEffect(() => {
    if (!running) return
    let raf = 0
    const tick = () => {
      const left = computeRemaining()
      setRemaining(left)
      if (left === 0) {
        alertExpired()
        setRunning(false)
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [running])

  useEffect(() => {
    if (!running) return
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return
      const left = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000))
      setRemaining(left)
      if (left === 0) {
        alertExpired()
        setRunning(false)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [running])

  const start = (seconds: number) => {
    // eslint-disable-next-line react/purity
    endAtRef.current = Date.now() + seconds * 1000
    // eslint-disable-next-line react/globals
    sharedEndAt = endAtRef.current
    setRemaining(seconds)
    setRunning(true)
  }

  const extend = () => {
    endAtRef.current += 30000
    // eslint-disable-next-line react/globals
    sharedEndAt = endAtRef.current
    setRemaining(computeRemaining())
  }

  const stop = () => {
    setRunning(false)
    setRemaining(0)
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')

  return (
    <div className="flex items-center gap-2 rounded-lg border border-edge bg-surface px-3 py-2">
      <span className="text-xs font-medium uppercase tracking-wide text-dim2">
        Descanso
      </span>
      <span
        className={`font-mono text-lg font-bold tabular-nums ${
          running && remaining === 0 ? 'text-emerald-400' : 'text-strong'
        }`}
      >
        {mm}:{ss}
      </span>
      {!running ? (
        <div className="flex gap-1">
          {QUICK_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => start(s)}
              className="min-h-12 rounded-md bg-surface2 px-3 py-2 text-xs font-medium text-soft transition-colors hover:bg-emerald-500/20 hover:text-emerald-400"
            >
              {s / 60}m
            </button>
          ))}
        </div>
      ) : (
        <div className="flex gap-1">
          <button
            onClick={extend}
            className="min-h-12 rounded-md bg-surface2 px-3 py-2 text-xs font-medium text-soft transition-colors hover:bg-emerald-500/20 hover:text-emerald-400"
          >
            +30s
          </button>
          <button
            onClick={stop}
            className="min-h-12 rounded-md bg-surface2 px-3 py-2 text-xs font-medium text-soft transition-colors hover:bg-red-500/20 hover:text-red-400"
          >
            Detener
          </button>
        </div>
      )}
    </div>
  )
}