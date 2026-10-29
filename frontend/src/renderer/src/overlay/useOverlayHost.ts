import { useEffect, useMemo, useState } from 'react'
import type { OverlaySnapshot } from '../features/overlay/lib/overlayState'
import {
  normalizeOverlayLayout,
  OVERLAY_DEFAULT_LAYOUT,
  settleOverlayDraft,
  type OverlayDraft,
  type OverlayFrame,
  type OverlayLayout
} from '../features/overlay/lib/overlayLayout'

/**
 * Área de trabalho do monitor do jogo e onde a janela começa nela (DIP = px do
 * CSS). Até o main dizer, a janela é a área inteira.
 */
function initialFrame(): OverlayFrame {
  return { area: { width: window.innerWidth, height: window.innerHeight }, origin: { x: 0, y: 0 } }
}

export interface OverlayHost {
  snapshot: OverlaySnapshot | null
  editing: boolean
  frame: OverlayFrame
  /** Layout salvo (o do estado do main). */
  saved: OverlayLayout
  /** Arraste que ainda espera o salvo chegar. */
  draft: OverlayDraft | null
  setDraft: (draft: OverlayDraft | null) => void
}

/** Assina o main: estado da call, modo de edição e a moldura da janela. */
export function useOverlayHost(): OverlayHost {
  const [snapshot, setSnapshot] = useState<OverlaySnapshot | null>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<OverlayDraft | null>(null)
  const [frame, setFrame] = useState<OverlayFrame>(initialFrame)

  useEffect(() => {
    const overlay = window.api?.overlay
    if (!overlay) return
    let alive = true
    const offUpdate = overlay.onUpdate((next) => {
      setSnapshot(next)
      // Salvo novo: o arraste que esperava por ele acabou.
      setDraft((prev) => settleOverlayDraft(normalizeOverlayLayout(next.layout), prev))
    })
    const offEditing = overlay.onEditing(setEditing)
    const offFrame = overlay.onFrame(setFrame)
    // Depois de assinar: o main só liga a edição com a página ouvindo.
    overlay.ready().then((state) => {
      if (!alive) return
      setSnapshot((prev) => prev ?? state.snapshot)
      setFrame((prev) => state.frame ?? prev)
      setEditing(state.editing)
    })
    return () => {
      alive = false
      offUpdate()
      offEditing()
      offFrame()
    }
  }, [])

  const savedRaw = snapshot?.layout
  const saved = useMemo(
    () => (savedRaw ? normalizeOverlayLayout(savedRaw) : OVERLAY_DEFAULT_LAYOUT),
    [savedRaw]
  )
  return { snapshot, editing, frame, saved, draft, setDraft }
}
