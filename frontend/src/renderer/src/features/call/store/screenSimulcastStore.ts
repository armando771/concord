import { create } from 'zustand'
import { loadScreenSimulcast, saveScreenSimulcast, type SimulcastMode } from '../lib/screenSimulcast'

// "Enviar também em 720p": Automático (padrão), Ligada ou Desligada, salvo neste
// dispositivo. Lido ao publicar a tela.

interface ScreenSimulcastState {
  mode: SimulcastMode
  setMode: (mode: SimulcastMode) => void
}

export const useScreenSimulcastStore = create<ScreenSimulcastState>((set) => ({
  mode: loadScreenSimulcast(),
  setMode: (mode) => {
    saveScreenSimulcast(mode)
    set({ mode })
  }
}))
