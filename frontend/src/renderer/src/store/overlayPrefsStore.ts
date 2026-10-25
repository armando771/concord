import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { clampOverlayOpacity, OVERLAY_OPACITY_DEFAULT } from '../lib/overlayState'

interface OverlayPrefsState {
  enabled: boolean
  /** Opacidade da lista no jogo, em %. */
  opacity: number
  setEnabled: (enabled: boolean) => void
  setOpacity: (opacity: number) => void
}

/** Overlay nos jogos (Configurações → App), ligado por padrão. */
export const useOverlayPrefsStore = create<OverlayPrefsState>()(
  persist(
    (set) => ({
      enabled: true,
      opacity: OVERLAY_OPACITY_DEFAULT,
      setEnabled: (enabled) => set({ enabled }),
      setOpacity: (opacity) => set({ opacity: clampOverlayOpacity(opacity) })
    }),
    { name: 'concord-overlay-prefs' }
  )
)
