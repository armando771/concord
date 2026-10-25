import { useEffect, type RefObject } from 'react'
import { useMusicStore } from '../../store/musicStore'
import { videoSyncAction, videoTargetSec } from '../../lib/music'

const CHECK_MS = 2000
const AUDIO_LATENCY_MS = 250
const RATE_HOLD_MS = 3000

/** Mantém o <video> mudo alinhado ao áudio do Maestro (a cada 2 s). */
export function useMusicVideoSync(
  ref: RefObject<HTMLVideoElement | null>,
  startedAt: number | null
): void {
  useEffect(() => {
    if (startedAt == null) return
    let rateTimer: ReturnType<typeof setTimeout> | null = null
    const check = (): void => {
      const el = ref.current
      if (!el || el.readyState < 2) return
      const target = videoTargetSec({
        startedAt,
        nowMs: Date.now(),
        serverOffsetMs: useMusicStore.getState().serverOffsetMs,
        audioLatencyMs: AUDIO_LATENCY_MS
      })
      if (target < 0) return
      const action = videoSyncAction(el.currentTime, target)
      if (action.kind === 'seek') {
        el.currentTime = action.to
        el.playbackRate = 1
      } else if (action.kind === 'rate') {
        el.playbackRate = action.rate
        if (rateTimer) clearTimeout(rateTimer)
        rateTimer = setTimeout(() => {
          if (ref.current) ref.current.playbackRate = 1
        }, RATE_HOLD_MS)
      }
      if (el.paused) void el.play().catch(() => {})
    }
    const interval = setInterval(check, CHECK_MS)
    const el = ref.current
    el?.addEventListener('loadeddata', check)
    return () => {
      clearInterval(interval)
      if (rateTimer) clearTimeout(rateTimer)
      el?.removeEventListener('loadeddata', check)
    }
  }, [ref, startedAt])
}
