import { create } from 'zustand'

/** Quem está falando agora (vem da mídia, muda várias vezes por segundo: fica fora das outras stores). */
interface SpeakingState {
  speaking: string[]
  set: (speaking: string[]) => void
  reset: () => void
}

export const useSpeakingStore = create<SpeakingState>()((set) => ({
  speaking: [],
  set: (speaking) => set({ speaking }),
  reset: () => set({ speaking: [] })
}))
