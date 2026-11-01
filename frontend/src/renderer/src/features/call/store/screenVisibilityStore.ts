import { create } from 'zustand'

// Cada <video> de live de outra pessoa diz se está na área visível do app
// (IntersectionObserver). Quem decide pausar é lib/screenVideoPause.ts.

export interface LiveElement {
  userId: string
  visible: boolean
}

interface ScreenVisibilityState {
  /** chave do <video> → de quem é a live e se aparece. */
  elements: Record<string, LiveElement>
  report: (key: string, userId: string, visible: boolean) => void
  remove: (key: string) => void
}

export const useScreenVisibilityStore = create<ScreenVisibilityState>((set, get) => ({
  elements: {},
  report: (key, userId, visible) => {
    const current = get().elements[key]
    if (current?.userId === userId && current.visible === visible) return
    set({ elements: { ...get().elements, [key]: { userId, visible } } })
  },
  remove: (key) => {
    if (!(key in get().elements)) return
    const { [key]: _removed, ...rest } = get().elements
    set({ elements: rest })
  }
}))
