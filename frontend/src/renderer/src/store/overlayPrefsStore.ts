import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  clampOverlayOpacity,
  migrateOverlayPrefs,
  OVERLAY_OPACITY_DEFAULT
} from '../lib/overlayState'

interface OverlayPrefsState {
  enabled: boolean
  /** Opacidade das pílulas em repouso no jogo, em % (quem fala fica mais forte). */
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
    {
      name: 'concord-overlay-prefs',
      // v1: opacidade virou "em repouso" (10–60%); a salva antes é encaixada.
      version: 1,
      migrate: (persisted) => migrateOverlayPrefs(persisted) as unknown as OverlayPrefsState
    }
  )
)
