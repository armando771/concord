import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useCallStore } from '../../store/callStore'
import { useMusicStore } from '../../store/musicStore'
import { duckTarget, isMaestroIdentity, stepGain } from '../../lib/music'

/** Ganho atual da música (1 = normal), com rampas a cada frame. */
export function useMusicDucking(): number {
  const speakingIds = useCallStore((s) => s.speakingIds)
  const meId = useAuthStore((s) => s.user?.id)
  const enabled = useMusicStore((s) => s.duckingEnabled)
  const [gain, setGain] = useState(1)
  const lastSpeech = useRef(0)
  const gainRef = useRef(1)

  useEffect(() => {
    if (speakingIds.some((id) => id !== meId && !isMaestroIdentity(id)))
      lastSpeech.current = performance.now()
  }, [speakingIds, meId])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const tick = (now: number): void => {
      const target = duckTarget({
        speakingIds,
        meId,
        enabled,
        lastOtherSpeechAt: lastSpeech.current,
        now
      })
      const next = stepGain(gainRef.current, target, now - last)
      last = now
      if (next !== gainRef.current) {
        gainRef.current = next
        setGain(next)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [speakingIds, meId, enabled])

  return gain
}
