import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Tela cheia de verdade (Fullscreen API) num elemento que envolve o vídeo e os
 * controles. `enabled` falso (parou de assistir, a transmissão acabou) sai da
 * tela cheia; desmontar também.
 */
export function useStreamFullscreen(enabled: boolean): {
  ref: React.RefObject<HTMLDivElement | null>
  active: boolean
  toggle: () => void
} {
  const ref = useRef<HTMLDivElement | null>(null)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    const el = ref.current
    const sync = (): void => setFullscreen(!!el && document.fullscreenElement === el)
    document.addEventListener('fullscreenchange', sync)
    return () => {
      document.removeEventListener('fullscreenchange', sync)
      if (el && document.fullscreenElement === el) void document.exitFullscreen().catch(() => {})
    }
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!enabled && el && document.fullscreenElement === el) {
      void document.exitFullscreen().catch(() => {})
    }
  }, [enabled])

  const toggle = useCallback(() => {
    const el = ref.current
    if (!el) return
    if (document.fullscreenElement === el) {
      void document.exitFullscreen().catch(() => {})
    } else if (enabled) {
      void el.requestFullscreen().catch(() => {})
    }
  }, [enabled])

  return { ref, active: enabled && fullscreen, toggle }
}
