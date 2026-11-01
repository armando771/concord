import Button from '../../../shared/ui/Button'
import type { LocalTTSVoice } from '../hooks/useLocalTTSVoice'
import { voiceStatusView } from '../lib/ttsVoiceStatus'

/** Linux: estado da voz baixada no primeiro uso (baixando, pronta, erro). */
function TTSVoiceStatus({ voice }: { voice: LocalTTSVoice }): React.JSX.Element | null {
  if (!voice.state) return null
  const view = voiceStatusView(voice.state)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p
        role="status"
        className={`min-w-0 flex-1 text-xs ${view.warning ? 'text-warning' : 'text-gray-400'}`}
      >
        {view.text}
      </p>
      {view.retry && (
        <Button variant="secondary" className="min-h-11 shrink-0 text-xs" onClick={voice.prepare}>
          Tentar de novo
        </Button>
      )}
    </div>
  )
}

export default TTSVoiceStatus
