import { create } from 'zustand'

/** Jogo cuja janela está sendo transmitida pelo card (null = nenhum). */
export const useGameBroadcastStore = create<{
  game: string | null
  set: (game: string | null) => void
}>((set) => ({ game: null, set: (game) => set({ game }) }))
