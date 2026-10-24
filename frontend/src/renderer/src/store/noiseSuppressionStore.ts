import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface NoiseSuppressionState {
  /** Preferência do usuário (RNNoise ligado ou não). */
  enabled: boolean
  /** O RNNoise carregou no último microfone aberto (falso = caiu no do Chromium). */
  available: boolean
  setEnabled: (enabled: boolean) => void
  setAvailable: (available: boolean) => void
}

export const useNoiseSuppressionStore = create<NoiseSuppressionState>()(
  persist(
    (set) => ({
      enabled: true,
      available: true,
      setEnabled: (enabled) => set({ enabled }),
      setAvailable: (available) => set({ available })
    }),
    {
      name: 'concord-noise-suppression',
      partialize: (s) => ({ enabled: s.enabled })
    }
  )
)
