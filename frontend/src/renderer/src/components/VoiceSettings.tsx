import { useEffect, useState } from 'react'
import { useCallStore } from '../store/callStore'
import { getAudioStream } from '../lib/rtc'
import { useNoiseSuppressionStore } from '../store/noiseSuppressionStore'

const METER_FFT_SIZE = 512

function useAudioDevices(): MediaDeviceInfo[] {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])

  useEffect(() => {
    let cancelled = false
    const refresh = async (): Promise<void> => {
      let list = await navigator.mediaDevices.enumerateDevices()
      // Sem permissão de microfone os nomes vêm vazios: pede uma vez e relista.
      if (list.some((d) => d.kind === 'audioinput' && !d.label)) {
        try {
          const probe = await navigator.mediaDevices.getUserMedia({ audio: true })
          probe.getTracks().forEach((t) => t.stop())
          list = await navigator.mediaDevices.enumerateDevices()
        } catch {
          // sem permissão: fica com os ids sem nome
        }
      }
      if (!cancelled) setDevices(list)
    }
    void refresh()
    navigator.mediaDevices.addEventListener('devicechange', refresh)
    return () => {
      cancelled = true
      navigator.mediaDevices.removeEventListener('devicechange', refresh)
    }
  }, [])

  return devices
}

/** Nível do microfone escolhido (0–1), para o usuário ver se está captando. */
function useMicLevel(deviceId: string): number {
  const [level, setLevel] = useState(0)

  useEffect(() => {
    let stream: MediaStream | null = null
    let ctx: AudioContext | null = null
    let frame = 0
    let cancelled = false

    void getAudioStream(deviceId)
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop())
          return
        }
        stream = s
        ctx = new AudioContext()
        const analyser = ctx.createAnalyser()
        analyser.fftSize = METER_FFT_SIZE
        ctx.createMediaStreamSource(s).connect(analyser)
        const data = new Uint8Array(analyser.fftSize)
        const tick = (): void => {
          analyser.getByteTimeDomainData(data)
          let peak = 0
          for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128)
          setLevel(peak)
          frame = requestAnimationFrame(tick)
        }
        tick()
      })
      .catch(() => setLevel(0))

    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((t) => t.stop())
      void ctx?.close()
    }
  }, [deviceId])

  return level
}

function DeviceSelect({
  label,
  value,
  devices,
  onChange
}: {
  label: string
  value: string
  devices: MediaDeviceInfo[]
  onChange: (deviceId: string) => void
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-gray-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
      >
        <option value="">Padrão do sistema</option>
        {devices
          .filter((d) => d.deviceId && d.deviceId !== 'default')
          .map((d, i) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Dispositivo ${i + 1}`}
            </option>
          ))}
      </select>
    </label>
  )
}

/** Seção "Voz" das configurações: microfone, saída e medidor de nível. */
function VoiceSettings(): React.JSX.Element {
  const devices = useAudioDevices()
  const inputDeviceId = useCallStore((s) => s.inputDeviceId)
  const outputDeviceId = useCallStore((s) => s.outputDeviceId)
  const setInputDevice = useCallStore((s) => s.setInputDevice)
  const setOutputDevice = useCallStore((s) => s.setOutputDevice)
  const level = useMicLevel(inputDeviceId)
  const canChooseOutput = 'setSinkId' in HTMLMediaElement.prototype
  const noiseSuppressionEnabled = useNoiseSuppressionStore((s) => s.enabled)
  const setNoiseSuppressionEnabled = useNoiseSuppressionStore((s) => s.setEnabled)

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-sm font-semibold text-white">Voz</p>
      <DeviceSelect
        label="Microfone"
        value={inputDeviceId}
        devices={devices.filter((d) => d.kind === 'audioinput')}
        onChange={(id) => void setInputDevice(id)}
      />
      <div
        className="h-1.5 overflow-hidden rounded-full bg-white/10"
        aria-label="Nível do microfone"
      >
        <div
          className="h-full rounded-full bg-[#23a55a] transition-[width] duration-75"
          style={{ width: `${Math.min(100, Math.round(level * 140))}%` }}
        />
      </div>
      {canChooseOutput && (
        <DeviceSelect
          label="Saída de áudio"
          value={outputDeviceId}
          devices={devices.filter((d) => d.kind === 'audiooutput')}
          onChange={setOutputDevice}
        />
      )}
      <div className="space-y-2 pt-1">
        <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Processamento de áudio</p>
        <label className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2">
          <div>
            <p className="text-sm text-white">Supressão de ruído (RNNoise)</p>
            <p className="text-xs text-gray-400">Reduz ruídos constantes como ventilador, teclado e ar-condicionado.</p>
          </div>
          <button
            type="button"
            onClick={() => setNoiseSuppressionEnabled(!noiseSuppressionEnabled)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              noiseSuppressionEnabled ? 'bg-[#5865f2]' : 'bg-white/20'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                noiseSuppressionEnabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </label>
      </div>
    </div>
  )
}

export default VoiceSettings
