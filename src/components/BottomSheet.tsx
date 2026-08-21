import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'

interface BottomSheetProps {
  title: string
  onClose: () => void
  children: ReactNode
}

export default function BottomSheet({ title, onClose, children }: BottomSheetProps) {
  // Portal a body: dentro del wrapper `animate-rise` de la ruta (transform
  // permanente) un `fixed` queda relativo al contenido y el sheet se sale del
  // viewport.
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="glass-strong card-hairline w-full max-w-md animate-rise rounded-t-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-edge2" />
        <h2 className="font-semibold">{title}</h2>
        <div className="mt-3">{children}</div>
      </div>
    </div>,
    document.body,
  )
}