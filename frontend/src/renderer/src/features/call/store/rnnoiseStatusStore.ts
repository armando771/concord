import { create } from 'zustand'

// Se o RNNoise carregou no último microfone aberto (falso = caiu no fallback
// do Chromium). Estado de execução: não persiste.

interface RnnoiseStatusState {
  available: boolean
  setAvailable: (available: boolean) => void
}

export const useRnnoiseStatusStore = create<RnnoiseStatusState>()((set) => ({
  available: true,
  setAvailable: (available) => set({ available })
}))
