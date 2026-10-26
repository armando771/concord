import { useCallStore } from '../store/callStore'
import { useNoiseSuppressionStore } from '../store/noiseSuppressionStore'
import { useVoiceAudioStore } from '../store/voiceAudioStore'
import { deviceOptions, type DeviceOption } from '../lib/audioDevices'
import { thresholdDb } from '../lib/voiceActivity'
import { CAN_CHOOSE_OUTPUT, useAudioDevices } from '../hooks/useAudioDevices'
import { NoiseSuppressionSettings } from './NoiseSuppressionPopover'
import SensitivityMeter from './SensitivityMeter'
import VolumeSlider from './VolumeSlider'
import Switch from '../../../shared/ui/Switch'

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
        className="glass-input !py-2 text-sm"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id} className="bg-floating">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Seção "Voz" das configurações: microfone, saída, volumes, detecção de voz e teste. */
function VoiceSettings(): React.JSX.Element {
  const devices = useAudioDevices()
  const inputDeviceId = useCallStore((s) => s.inputDeviceId)
  const outputDeviceId = useCallStore((s) => s.outputDeviceId)
  const setInputDevice = useCallStore((s) => s.setInputDevice)
  const setOutputDevice = useCallStore((s) => s.setOutputDevice)
  const inputVolume = useVoiceAudioStore((s) => s.inputVolume)
  const outputVolume = useVoiceAudioStore((s) => s.outputVolume)
  const setInputVolume = useVoiceAudioStore((s) => s.setInputVolume)
  const setOutputVolume = useVoiceAudioStore((s) => s.setOutputVolume)
  const detectionEnabled = useVoiceAudioStore((s) => s.detectionEnabled)
  const setDetectionEnabled = useVoiceAudioStore((s) => s.setDetectionEnabled)
  const sensitivity = useVoiceAudioStore((s) => s.sensitivity)
  const setSensitivity = useVoiceAudioStore((s) => s.setSensitivity)
  const rnnoiseAvailable = useNoiseSuppressionStore((s) => s.available)
  const threshold = thresholdDb(sensitivity)

  return (
    <div className="space-y-3 rounded-xl border border-subtle bg-fg/5 p-4">
      <p className="text-ds-md font-medium text-strong">Voz</p>
      <DeviceSelect
        label="Microfone"
        value={inputDeviceId}
        options={deviceOptions(devices, 'audioinput')}
        onChange={(id) => void setInputDevice(id)}
      />
      <VolumeSlider label="Volume de entrada" value={inputVolume} onChange={setInputVolume} />
      {CAN_CHOOSE_OUTPUT && (
        <DeviceSelect
          label="Saída de áudio"
          value={outputDeviceId}
          options={deviceOptions(devices, 'audiooutput')}
          onChange={setOutputDevice}
        />
      )}
      <VolumeSlider label="Volume de saída" value={outputVolume} onChange={setOutputVolume} />
      <div className="space-y-3 border-t border-subtle pt-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-ds-sm font-medium text-strong">Detecção de voz</p>
            <p className="text-xs text-gray-400">
              Envia sua voz só quando ela passa da sensibilidade.
            </p>
          </div>
          <Switch
            checked={detectionEnabled}
            onChange={setDetectionEnabled}
            label="Detecção de voz"
          />
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center justify-between text-ds-sm font-medium text-gray-400">
            Sensibilidade
            <span className="text-strong">{Math.round(threshold)} dB</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={sensitivity}
            onChange={(e) => setSensitivity(Number(e.target.value))}
            className="w-full cursor-pointer accent-brand"
          />
          <span className="text-xs text-gray-400">Mais à direita, capta vozes mais baixas.</span>
        </label>
        <SensitivityMeter thresholdDb={threshold} />
        {!rnnoiseAvailable && (
          <p className="text-xs text-warning">
            O volume de entrada e a detecção de voz precisam do RNNoise, que não carregou neste
            computador.
          </p>
        )}
      </div>
      <div className="border-t border-subtle pt-3">
        <NoiseSuppressionSettings />
      </div>
    </div>
  )
}

export default VoiceSettings
