import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  clampOverlayOpacity,
  migrateOverlayPrefs,
  OVERLAY_PREFS_VERSION,
  OVERLAY_OPACITY_DEFAULT
} from '../lib/overlayState'
import {
  normalizeOverlayLayout,
  OVERLAY_DEFAULT_LAYOUT,
  type OverlayLayout
} from '../lib/overlayLayout'

interface OverlayPrefsState {
  enabled: boolean
  /** Opacidade das pílulas em repouso no jogo, em % (quem fala fica mais forte). */
  opacity: number
  /** Posição (fração da área de trabalho) e tamanho da lista no jogo. */
  layout: OverlayLayout
  setEnabled: (enabled: boolean) => void
  setOpacity: (opacity: number) => void
  setLayout: (layout: OverlayLayout) => void
  /** "Restaurar posição": borda esquerda, no meio, 1×. */
  resetLayout: () => void
}

/** Overlay nos jogos (Configurações → App), ligado por padrão. */
export const useOverlayPrefsStore = create<OverlayPrefsState>()(
  persist(
    (set) => ({
      enabled: true,
      opacity: OVERLAY_OPACITY_DEFAULT,
      layout: OVERLAY_DEFAULT_LAYOUT,
      setEnabled: (enabled) => set({ enabled }),
      setOpacity: (opacity) => set({ opacity: clampOverlayOpacity(opacity) }),
      setLayout: (layout) => set({ layout: normalizeOverlayLayout(layout) }),
      resetLayout: () => set({ layout: OVERLAY_DEFAULT_LAYOUT })
    }),
    {
      name: 'concord-overlay-prefs',
      // v1: opacidade virou "em repouso" (10–60%); a salva antes volta a 30%.
      version: OVERLAY_PREFS_VERSION,
      migrate: (persisted, version) =>
        migrateOverlayPrefs(persisted, version) as unknown as OverlayPrefsState
    }
  )
)
