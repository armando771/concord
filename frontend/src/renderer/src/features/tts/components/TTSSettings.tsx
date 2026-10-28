import Switch from '../../../shared/ui/Switch'
import { useLocalTTSVoice } from '../hooks/useLocalTTSVoice'
import { useTTSVoiceAvailable } from '../hooks/useTTSVoiceAvailable'
import { useTTSSettingsStore } from '../store/ttsSettingsStore'
import TTSVoiceStatus from './TTSVoiceStatus'

/** Configurações → Voz: ouvir (ou não) as mensagens /tts quando estiver em call. */
function TTSSettings(): React.JSX.Element {
  const enabled = useTTSSettingsStore((s) => s.enabled)
  const setEnabled = useTTSSettingsStore((s) => s.setEnabled)
  const voiceAvailable = useTTSVoiceAvailable()
  // Linux: voz baixada no primeiro uso, em vez das vozes do sistema.
  const localVoice = useLocalTTSVoice()
  const toggle = (on: boolean): void => {
    setEnabled(on)
    if (on) localVoice?.prepare()
  }

  return (
    <div className="space-y-3 rounded-xl border border-subtle bg-fg/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-ds-sm font-medium text-strong">Ouvir mensagens de TTS</p>
          <p className="text-xs text-gray-400">
            Lê em voz as mensagens /tts do servidor (ou da DM) da call em que você está.
          </p>
        </div>
        <Switch checked={enabled} onChange={toggle} label="Ouvir mensagens de TTS" />
      </div>
      {localVoice && <TTSVoiceStatus voice={localVoice} />}
      {!localVoice && voiceAvailable === false && (
        <p className="text-xs text-warning">
          Este aparelho não tem voz de leitura instalada: as mensagens /tts aparecem só no chat.
        </p>
      )}
    </div>
  )
}

export default TTSSettings
