import { useEffect, useRef, useState } from 'react'
import { useCallStore } from '../../store/callStore'
import { showToast } from '../../store/toastStore'
import { getAudioStream } from '../../lib/rtc'

const SEGMENTS = 30
const FFT_SIZE = 1024
/** Faixa do medidor: −60 dBFS (vazio) a 0 dBFS (cheio). */
const FLOOR_DB = -60

/** Nível RMS (0–1, escala em dB) de um bloco do analisador. */
function levelFromSamples(samples: Float32Array): number {
  let sum = 0
  for (const v of samples) sum += v * v
  const db = 10 * Math.log10(sum / samples.length + 1e-12)
  return Math.min(1, Math.max(0, (db - FLOOR_DB) / -FLOOR_DB))
}

/**
 * "Teste do microfone" (como no Discord): abre o microfone escolhido com a
 * supressão de ruído atual, toca a sua voz de volta na saída escolhida e mostra
 * o nível do que os outros receberiam.
 */
function MicTest(): React.JSX.Element {
  const inputDeviceId = useCallStore((s) => s.inputDeviceId)
  const outputDeviceId = useCallStore((s) => s.outputDeviceId)
  const [testing, setTesting] = useState(false)
  const [level, setLevel] = useState(0)
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (!testing) return
    let cancelled = false
    let frame = 0
    let ctx: AudioContext | null = null
    let stopMic: (() => void) | null = null
    const audio = audioRef.current

    void getAudioStream(inputDeviceId)
      .then((mic) => {
        if (cancelled) {
          mic.stop()
          return
        }
        stopMic = mic.stop
        if (audio) {
          audio.srcObject = mic.stream
          void audio.play().catch(() => {})
        }
        ctx = new AudioContext()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = FFT_SIZE
        ctx.createMediaStreamSource(mic.stream).connect(analyser)
        const data = new Float32Array(analyser.fftSize)
        const tick = (): void => {
          analyser.getFloatTimeDomainData(data)
          setLevel(levelFromSamples(data))
          frame = requestAnimationFrame(tick)
        }
        tick()
      })
      .catch(() => {
        if (cancelled) return
        showToast.error('Não foi possível abrir o microfone.')
        setTesting(false)
      })

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      if (audio) audio.srcObject = null
      void ctx?.close()
      stopMic?.()
      setLevel(0)
    }
  }, [testing, inputDeviceId])

  useEffect(() => {
    const el = audioRef.current as
      (HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> }) | null
    void el?.setSinkId?.(outputDeviceId).catch(() => {})
  }, [outputDeviceId])

  const lit = Math.round(level * SEGMENTS)

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={() => setTesting((t) => !t)}
        className="shrink-0 cursor-pointer rounded-md bg-fg/10 px-4 py-1.5 text-sm font-medium text-strong transition-colors hover:bg-fg/15"
      >
        {testing ? 'Parar' : 'Testar'}
      </button>
      <div
        role="meter"
        aria-label="Nível do microfone"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(level * 100)}
        className="flex h-6 flex-1 items-center justify-between"
      >
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            key={i}
            className={`h-full w-[3px] rounded-full transition-colors duration-75 ${
              i < lit ? 'bg-success' : 'bg-fg/15'
            }`}
          />
        ))}
      </div>
      <audio ref={audioRef} className="hidden" />
    </div>
  )
}

export default MicTest
