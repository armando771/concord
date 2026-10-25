import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

/** Botão no aviso (ex.: "Restaurar"); clicar roda e fecha o aviso. */
export interface ToastAction {
  label: string
  run: () => void
}

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
  action?: ToastAction
}

interface ToastState {
  toasts: ToastMessage[]
  addToast: (message: string, type?: ToastType, durationMs?: number, action?: ToastAction) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  addToast: (message, type = 'info', durationMs = 4000, action) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: ToastMessage = { id, type, message, action }

    set((state) => ({ toasts: [...state.toasts, newToast] }))

    if (durationMs > 0) {
      setTimeout(() => {
        get().removeToast(id)
      }, durationMs)
    }
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  }
}))

export const showToast = {
  success: (msg: string, duration?: number) =>
    useToastStore.getState().addToast(msg, 'success', duration),
  error: (msg: string, duration?: number, action?: ToastAction) =>
    useToastStore.getState().addToast(msg, 'error', duration, action),
  info: (msg: string, duration?: number) => useToastStore.getState().addToast(msg, 'info', duration)
}
