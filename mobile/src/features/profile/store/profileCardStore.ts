import { create } from 'zustand'
import type { ProfileData } from '../lib/profileTypes'

interface ProfileCardState {
  /** Último cartão visto de cada pessoa, só durante a sessão: abre na hora e recarrega por baixo. */
  cards: Record<string, ProfileData>
  put: (profile: ProfileData) => void
  reset: () => void
}

export const useProfileCardStore = create<ProfileCardState>()((set) => ({
  cards: {},
  put: (profile) => set((s) => ({ cards: { ...s.cards, [profile.id]: profile } })),
  reset: () => set({ cards: {} })
}))
