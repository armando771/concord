import { useVoiceAudioStore } from '../store/voiceAudioStore'
import VolumeSlider from './VolumeSlider'

/** Volume de entrada (microfone) ou de saída (fone) dentro do menu rápido da barra. */
function DeviceVolume({ kind }: { kind: 'input' | 'output' }): React.JSX.Element {
  const input = kind === 'input'
  const volume = useVoiceAudioStore((s) => (input ? s.inputVolume : s.outputVolume))
  const setVolume = useVoiceAudioStore((s) => (input ? s.setInputVolume : s.setOutputVolume))
  return (
    <div className="px-2 py-1.5">
      <VolumeSlider
        label={input ? 'Volume de entrada' : 'Volume de saída'}
        value={volume}
        onChange={setVolume}
      />
    </div>
  )
}

export default DeviceVolume
