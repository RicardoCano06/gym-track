import { createContext, useContext } from 'react'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface ToastContextValue {
  pushToast: (type: ToastType, message: string, action?: ToastAction) => void
}

export const ToastContext = createContext<ToastContextValue>({
  pushToast: () => {},
})

export function useToast() {
  return useContext(ToastContext)
}