import { useEffect, useState } from 'react'
import { useCallStore } from '../store/callStore'
import { NoiseSuppressionSettings } from './call/NoiseSuppressionPopover'

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
      <span className="text-ds-sm font-medium text-gray-400">
        {label}
      </span>
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

/** Seção "Voz" das configurações: microfone, saída, supressão de ruído e teste. */
function VoiceSettings(): React.JSX.Element {
  const devices = useAudioDevices()
  const inputDeviceId = useCallStore((s) => s.inputDeviceId)
  const outputDeviceId = useCallStore((s) => s.outputDeviceId)
  const setInputDevice = useCallStore((s) => s.setInputDevice)
  const setOutputDevice = useCallStore((s) => s.setOutputDevice)
  const canChooseOutput = 'setSinkId' in HTMLMediaElement.prototype

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-ds-md font-medium text-white">Voz</p>
      <DeviceSelect
        label="Microfone"
        value={inputDeviceId}
        devices={devices.filter((d) => d.kind === 'audioinput')}
        onChange={(id) => void setInputDevice(id)}
      />
      {canChooseOutput && (
        <DeviceSelect
          label="Saída de áudio"
          value={outputDeviceId}
          devices={devices.filter((d) => d.kind === 'audiooutput')}
          onChange={setOutputDevice}
        />
      )}
      <div className="border-t border-white/10 pt-3">
        <NoiseSuppressionSettings />
      </div>
    </div>
  )
}

export default VoiceSettings
