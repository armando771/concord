import { create } from 'zustand'
import { loadScreenSimulcast, saveScreenSimulcast } from '../lib/screenSimulcast'

// "Enviar também em 720p" (salvo neste dispositivo, desmarcado por padrão).
// Lido ao publicar a tela.

interface ScreenSimulcastState {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
}

export const useScreenSimulcastStore = create<ScreenSimulcastState>((set) => ({
  enabled: loadScreenSimulcast(),
  setEnabled: (enabled) => {
    saveScreenSimulcast(enabled)
    set({ enabled })
  }
}))
