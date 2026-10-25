import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface OverlayPrefsState {
  enabled: boolean
  setEnabled: (enabled: boolean) => void
}

/** Overlay nos jogos (Configurações → App), ligado por padrão. */
export const useOverlayPrefsStore = create<OverlayPrefsState>()(
  persist(
    (set) => ({
      enabled: true,
      setEnabled: (enabled) => set({ enabled })
    }),
    { name: 'concord-overlay-prefs' }
  )
)
