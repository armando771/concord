import { useEffect, type RefObject } from 'react'
import { createSwipeTracker } from '../lib/swipe'
import { useMobileNavStore } from '../store/mobileNavStore'

// Onde arrastar na horizontal já tem outro significado (rolar código, a
// grade de propostas, um controle deslizante).
const OWN_GESTURE = 'pre, input, textarea, [role="slider"], .overflow-x-auto, [data-no-swipe]'

/** Arrastar para a direita no conteúdo volta para a lista (só no celular, por toque). */
export function useSwipeToList(ref: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    const tracker = createSwipeTracker(() => useMobileNavStore.getState().showNav())
    const onStart = (e: TouchEvent): void =>
      tracker.start({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        t: e.timeStamp,
        fingers: e.touches.length,
        own: Boolean((e.target as Element | null)?.closest?.(OWN_GESTURE))
      })
    const onEnd = (e: TouchEvent): void => {
      const t = e.changedTouches[0]
      tracker.end(t ? { x: t.clientX, y: t.clientY, t: e.timeStamp, width: window.innerWidth } : null)
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend', onEnd)
    }
  }, [ref, enabled])
}
