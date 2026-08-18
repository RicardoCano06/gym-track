import { useState } from 'react'
import { Dialog } from '@/components/Dialog'
import type { ConfirmRequest } from '@/components/Dialog'

export function useConfirm() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null)

  const ask = (req: ConfirmRequest) => setRequest(req)

  const dialog = request ? (
    <Dialog
      {...request}
      onCancel={() => setRequest(null)}
      onConfirm={async () => {
        await request.onConfirm()
        setRequest(null)
      }}
    />
  ) : null

  return { ask, dialog }
}