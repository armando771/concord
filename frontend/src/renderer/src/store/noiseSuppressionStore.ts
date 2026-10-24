import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface NoiseSuppressionState {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
}

export const useNoiseSuppressionStore = create<NoiseSuppressionState>()(
  persist(
    (set) => ({
      enabled: true,
      setEnabled: (enabled) => set({ enabled })
    }),
    { name: 'concord-noise-suppression' }
  )
)
