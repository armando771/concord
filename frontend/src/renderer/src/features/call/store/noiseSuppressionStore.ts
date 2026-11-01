import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Preferência da supressão de ruído (RNNoise), guardada neste PC. Desligada
// por padrão: só a escolha explícita do usuário (setEnabled) é gravada. Se o
// RNNoise carregou fica no rnnoiseStatusStore, que não persiste — quando ficava
// aqui, cada microfone aberto gravava o padrão como se fosse escolha.

interface NoiseSuppressionState {
  /** Preferência do usuário (RNNoise ligado ou não). */
  enabled: boolean
  setEnabled: (enabled: boolean) => void
}

/**
 * Versão 0 (até out/2026): ligada por padrão e gravada a cada microfone aberto,
 * então quase todo mundo tinha `enabled: true` sem ter escolhido. A versão 1
 * recomeça todos desligados.
 */
const VERSION = 1

export const useNoiseSuppressionStore = create<NoiseSuppressionState>()(
  persist(
    (set) => ({
      enabled: false,
      setEnabled: (enabled) => set({ enabled })
    }),
    {
      name: 'concord-noise-suppression',
      version: VERSION,
      partialize: (s) => ({ enabled: s.enabled }),
      migrate: () => ({ enabled: false })
    }
  )
)
