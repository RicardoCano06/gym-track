import { useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'

const REVEAL_WIDTH = 88

interface SwipeRowProps {
  children: ReactNode
  actionLabel: string
  onAction: () => void
  bgClass?: string
}

export default function SwipeRow({
  children,
  actionLabel,
  onAction,
  bgClass = 'bg-bg',
}: SwipeRowProps) {
  const [offset, setOffset] = useState(0)
  const dragRef = useRef<{
    startX: number
    startY: number
    active: boolean
    base: number
  } | null>(null)

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      active: false,
      base: offset,
    }
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    if (!drag) return
    const dx = e.clientX - drag.startX
    const dy = e.clientY - drag.startY
    if (!drag.active) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return
      drag.active = true
    }
    setOffset(Math.max(-REVEAL_WIDTH, Math.min(0, drag.base + dx)))
  }

  function endDrag() {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag?.active) return
    setOffset((current) => (current < -REVEAL_WIDTH / 2 ? -REVEAL_WIDTH : 0))
  }

  return (
    <div
      className="relative overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{ touchAction: 'pan-y' }}
    >
      <button
        onClick={onAction}
        className="absolute inset-y-0 right-0 flex w-22 items-center justify-center bg-red-500 text-sm font-semibold text-neutral-950"
        style={{ width: REVEAL_WIDTH }}
      >
        {actionLabel}
      </button>
      <div
        className={`relative transition-transform ${bgClass}`}
        style={{ transform: `translateX(${offset}px)` }}
      >
        {children}
      </div>
    </div>
  )
}