import { useCallStore } from '../store/callStore'
import { deviceOptions, type DeviceOption } from '../lib/audioDevices'
import { CAN_CHOOSE_OUTPUT, useAudioDevices } from './useAudioDevices'
import { NoiseSuppressionSettings } from './call/NoiseSuppressionPopover'

function DeviceSelect({
  label,
  value,
  options,
  onChange
}: {
  label: string
  value: string
  options: DeviceOption[]
  onChange: (deviceId: string) => void
}): React.JSX.Element {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-ds-sm font-medium text-gray-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-violet-500"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
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

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-ds-md font-medium text-white">Voz</p>
      <DeviceSelect
        label="Microfone"
        value={inputDeviceId}
        options={deviceOptions(devices, 'audioinput')}
        onChange={(id) => void setInputDevice(id)}
      />
      {CAN_CHOOSE_OUTPUT && (
        <DeviceSelect
          label="Saída de áudio"
          value={outputDeviceId}
          options={deviceOptions(devices, 'audiooutput')}
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
