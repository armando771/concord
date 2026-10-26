import { useEffect, useState } from 'react'
import { getAudioStream } from '../../lib/rtc'
import type { MicHandle } from '../../lib/noiseSuppression'
import { getCallMicrophone, useCallStore } from '../../store/callStore'
import { showToast } from '../../store/toastStore'

/** Faixa do medidor: −60 dBFS (vazio) a 0 dBFS (cheio). */
const FLOOR_DB = -60

/** Posição de um nível em dB na faixa do medidor (0 = vazio, 1 = cheio). */
function fraction(db: number): number {
  return Math.min(1, Math.max(0, (db - FLOOR_DB) / -FLOOR_DB))
}

/**
 * Nível do microfone, antes do portão, com o limiar da sensibilidade. Na
 * chamada usa o microfone dela; fora dela abre um próprio, como o teste.
 */
function SensitivityMeter({ thresholdDb }: { thresholdDb: number }): React.JSX.Element {
  const inputDeviceId = useCallStore((s) => s.inputDeviceId)
  const [level, setLevel] = useState(FLOOR_DB)

  useEffect(() => {
    let stopped = false
    let own: MicHandle | null = null
    let frame = 0
    if (!getCallMicrophone()) {
      void getAudioStream(inputDeviceId)
        .then((mic) => {
          if (stopped) mic.stop()
          else own = mic
        })
        .catch(() => {
          if (!stopped) showToast.error('Não foi possível abrir o microfone.')
        })
    }
    const tick = (): void => {
      const mic = getCallMicrophone() ?? own
      setLevel(mic?.readLevel?.() ?? FLOOR_DB)
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      own?.stop()
    }
  }, [inputDeviceId])

  return (
    <div
      role="meter"
      aria-label="Nível do microfone"
      aria-valuemin={FLOOR_DB}
      aria-valuemax={0}
      aria-valuenow={Math.round(level)}
      className="relative h-2.5 overflow-hidden rounded-full bg-fg/10"
    >
      <div
        className={`h-full ${level >= thresholdDb ? 'bg-success' : 'bg-fg/30'}`}
        style={{ width: `${fraction(level) * 100}%` }}
      />
      <div
        className="absolute inset-y-0 w-0.5 bg-white"
        style={{ left: `${fraction(thresholdDb) * 100}%` }}
      />
    </div>
  )
}

export default SensitivityMeter
