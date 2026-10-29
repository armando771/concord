import { create } from 'zustand'
import { loadScreenCodec, saveScreenCodec, type ScreenCodecPreference } from '../lib/screenCodec'

// Codec escolhido em Avançado (salvo neste dispositivo). Lido ao publicar a tela.

interface ScreenCodecState {
  preference: ScreenCodecPreference
  setPreference: (preference: ScreenCodecPreference) => void
}

export const useScreenCodecStore = create<ScreenCodecState>((set) => ({
  preference: loadScreenCodec(),
  setPreference: (preference) => {
    saveScreenCodec(preference)
    set({ preference })
  }
}))
