import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { useCallStore } from '../../call/store/callStore'
import { useMusicStore } from '../store/musicStore'
import { duckSettled, duckTarget, isMaestroIdentity, stepGain } from '../lib/music'

/**
 * Ganho atual da música (1 = normal), com rampas a cada frame. O laço de quadros
 * só roda enquanto há rampa ou espera: parado, ele obrigava o Chromium a montar um
 * quadro a cada 16 ms com o app aberto (mesmo sem música, minimizado ou sem call).
 */
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
      const input = { speakingIds, meId, enabled, lastOtherSpeechAt: lastSpeech.current, now }
      const next = stepGain(gainRef.current, duckTarget(input), now - last)
      last = now
      if (next !== gainRef.current) {
        gainRef.current = next
        setGain(next)
      }
      if (!duckSettled(input, next)) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [speakingIds, meId, enabled])

  return gain
}
