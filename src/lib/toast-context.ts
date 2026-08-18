import { createContext, useContext } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastContextValue {
  pushToast: (type: ToastType, message: string) => void
}

export const ToastContext = createContext<ToastContextValue>({
  pushToast: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}