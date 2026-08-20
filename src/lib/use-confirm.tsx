import { createPortal } from 'react-dom'
import { useState } from 'react'
import { Dialog } from '@/components/Dialog'
import type { ConfirmRequest } from '@/components/Dialog'

export function useConfirm() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)

  const ask = (req: ConfirmRequest) => setRequest(req)

  // Portal a document.body: los diálogos se montan dentro del wrapper
  // `animate-rise` de la ruta, que deja un `transform` permanente y rompe
  // `position: fixed` (el panel quedaba debajo del fold en móvil).
  const dialog = request
    ? createPortal(
        <Dialog
          {...request}
          onCancel={() => setRequest(null)}
          onConfirm={async () => {
            await request.onConfirm()
            setRequest(null)
          }}
        />,
        document.body,
      )
    : null

  return { ask, dialog }
}