import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// "Ouvir mensagens de TTS" (Configurações → Voz), guardado neste aparelho.
// Ligado por padrão: a mensagem /tts é para ser ouvida por quem está em call.

interface TTSSettingsState {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
}

export const useTTSSettingsStore = create<TTSSettingsState>()(
  persist(
    (set) => ({
      enabled: true,
      setEnabled: (enabled) => set({ enabled })
    }),
    { name: 'concord-tts', partialize: (s) => ({ enabled: s.enabled }) }
  )
)
