import { create } from 'zustand'

// Aviso de "reações demais" (21ª reação diferente numa mensagem), aberto de
// qualquer chat e mostrado uma vez só pelo ReactionLimitModal no App.

interface ReactionLimitState {
  open: boolean
  show: () => void
  close: () => void
}

export const useReactionLimitStore = create<ReactionLimitState>()((set) => ({
  open: false,
  show: () => set({ open: true }),
  close: () => set({ open: false })
}))
