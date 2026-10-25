import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info'

export interface ToastMessage {
  id: string
  type: ToastType
  message: string
}

interface ToastState {
  toasts: ToastMessage[]
  /** Devolve o id (para removeToast). durationMs 0 = fica até ser removido. */
  addToast: (message: string, type?: ToastType, durationMs?: number) => string
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  addToast: (message, type = 'info', durationMs = 4000) => {
    const id = Math.random().toString(36).substring(2, 9)
    const newToast: ToastMessage = { id, type, message }

    set((state) => ({ toasts: [...state.toasts, newToast] }))

    if (durationMs > 0) {
      setTimeout(() => {
        get().removeToast(id)
      }, durationMs)
    }
    return id
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  }
}))

export const showToast = {
  success: (msg: string, duration?: number) =>
    useToastStore.getState().addToast(msg, 'success', duration),
  error: (msg: string, duration?: number) =>
    useToastStore.getState().addToast(msg, 'error', duration),
  info: (msg: string, duration?: number) => useToastStore.getState().addToast(msg, 'info', duration)
}
