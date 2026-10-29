import { create } from 'zustand'

// Qual painel de estatísticas da live está aberto (um por vez no app inteiro;
// a coleta do getStats() só existe enquanto ele está aberto).

interface ScreenStatsState {
  /** userId da live com o painel aberto. */
  openFor: string | null
  toggle: (userId: string) => void
  close: () => void
}

export const useScreenStatsStore = create<ScreenStatsState>((set, get) => ({
  openFor: null,
  toggle: (userId) => set({ openFor: get().openFor === userId ? null : userId }),
  close: () => set({ openFor: null })
}))
