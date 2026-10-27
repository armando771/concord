import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

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
  /** Em animação de saída; ainda na lista até o fim dela. */
  leaving?: boolean
}

/** Duração da animação de saída (igual a `toast-out` no main.css). */
export const EXIT_MS = 160

interface ToastState {
  toasts: ToastMessage[]
  /** Devolve o id (para removeToast). durationMs 0 = fica até ser removido. */
  addToast: (message: string, type?: ToastType, durationMs?: number, action?: ToastAction) => string
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  addToast: (message, type = 'info', durationMs = 4000, action) => {
    // Mesma ação disparada várias vezes: reaproveita o aviso que já está na tela.
    const repetido = get().toasts.find(
      (t) => !t.leaving && t.type === type && t.message === message
    )
    if (repetido) return repetido.id

    const id = Math.random().toString(36).substring(2, 9)
    const newToast: ToastMessage = { id, type, message, action }

    set((state) => ({ toasts: [...state.toasts, newToast] }))

    if (durationMs > 0) {
      setTimeout(() => {
        get().removeToast(id)
      }, durationMs)
    }
    return id
  },
  removeToast: (id) => {
    if (!get().toasts.some((t) => t.id === id && !t.leaving)) return
    set((state) => ({ toasts: state.toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t)) }))
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, EXIT_MS)
  }
}))

export const showToast = {
  success: (msg: string, duration?: number) =>
    useToastStore.getState().addToast(msg, 'success', duration),
  error: (msg: string, duration?: number, action?: ToastAction) =>
    useToastStore.getState().addToast(msg, 'error', duration, action),
  warning: (msg: string, duration?: number) =>
    useToastStore.getState().addToast(msg, 'warning', duration),
  info: (msg: string, duration?: number) => useToastStore.getState().addToast(msg, 'info', duration)
}
