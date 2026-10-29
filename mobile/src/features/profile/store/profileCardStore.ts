import { create } from 'zustand'
import type { ProfileData } from '../lib/profileTypes'

interface ProfileCardState {
  /** Último cartão visto de cada pessoa, só durante a sessão: abre na hora e recarrega por baixo. */
  cards: Record<string, ProfileData>
  /** Sobe a cada reset (logout): resposta que saiu antes dele não pode repovoar o cache da próxima conta. */
  epoch: number
  put: (profile: ProfileData) => void
  reset: () => void
}

export const useProfileCardStore = create<ProfileCardState>()((set) => ({
  cards: {},
  epoch: 0,
  put: (profile) => set((s) => ({ cards: { ...s.cards, [profile.id]: profile } })),
  reset: () => set((s) => ({ cards: {}, epoch: s.epoch + 1 }))
}))
