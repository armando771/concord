import { create } from 'zustand'
import type { Limitation } from '../lib/screenAdaptSample'
import { adaptDropNotice } from '../lib/screenAdaptNotice'
import { showToast } from '../../../shared/store/toastStore'

// Qualidade em que a minha live está saindo agora (o controlador pode ter
// descido de degrau). Lido pelo seletor de qualidade da live e pelo painel.

export interface ScreenAdaptView {
  /** "1080p 60": o que a pessoa escolheu. */
  chosen: string
  /** "720p 60": o que está saindo. */
  effective: string
  /** Abaixo do escolhido. */
  reduced: boolean
  /** Por que desceu (ou por que está limitada no piso). */
  reason: Limitation | null
  /** Degrau atual (0 = o escolhido). */
  step: number
}

interface ScreenAdaptState {
  view: ScreenAdaptView | null
  setView: (view: ScreenAdaptView | null) => void
}

export const useScreenAdaptStore = create<ScreenAdaptState>((set, get) => ({
  view: null,
  setView: (view) => {
    // Aviso discreto para quem transmite, só quando desce de degrau.
    const notice = adaptDropNotice(get().view, view)
    if (notice) showToast.warning(notice)
    set({ view })
  }
}))
