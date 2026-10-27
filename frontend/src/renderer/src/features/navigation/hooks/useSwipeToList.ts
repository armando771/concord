import { useEffect, type RefObject } from 'react'
import { isSwipeToList } from '../lib/swipe'
import { useMobileNavStore } from '../store/mobileNavStore'

// Onde arrastar na horizontal já tem outro significado (rolar código, a
// grade de propostas, um controle deslizante).
const OWN_GESTURE = 'pre, input, textarea, [role="slider"], .overflow-x-auto, [data-no-swipe]'

/** Arrastar para a direita no conteúdo volta para a lista (só no celular, por toque). */
export function useSwipeToList(ref: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    let start: { x: number; y: number; t: number } | null = null
    const onStart = (e: TouchEvent): void => {
      const t = e.touches[0]
      const own = (e.target as Element | null)?.closest?.(OWN_GESTURE)
      start = e.touches.length === 1 && !own ? { x: t.clientX, y: t.clientY, t: e.timeStamp } : null
    }
    const onEnd = (e: TouchEvent): void => {
      const t = e.changedTouches[0]
      if (!start || !t) return
      const swipe = isSwipeToList({
        startX: start.x,
        width: window.innerWidth,
        dx: t.clientX - start.x,
        dy: t.clientY - start.y,
        ms: e.timeStamp - start.t
      })
      start = null
      if (swipe) useMobileNavStore.getState().showNav()
    }
    el.addEventListener('touchstart', onStart, { passive: true })
    el.addEventListener('touchend', onEnd, { passive: true })
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchend', onEnd)
    }
  }, [ref, enabled])
}
