import { create } from 'zustand'

/** Aviso curto sobre o fim ou a falha de uma chamada ("Sala trancada", "Fulano recusou a chamada"). */
interface CallNoticeState {
  message: string | null
  show: (message: string) => void
  dismiss: () => void
}

export const useCallNoticeStore = create<CallNoticeState>()((set) => ({
  message: null,
  show: (message) => set({ message }),
  dismiss: () => set({ message: null })
}))
