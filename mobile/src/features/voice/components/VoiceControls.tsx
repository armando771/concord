import { View } from 'react-native'
import { IconButton } from '../../../shared/ui/IconButton'
import { useVoiceControlsStore } from '../store/voiceControlsStore'

/** Microfone e fone do painel do usuário (por ora só estado local; a voz liga depois). */
export function VoiceControls() {
  const muted = useVoiceControlsStore((s) => s.muted)
  const deafened = useVoiceControlsStore((s) => s.deafened)
  const toggleMute = useVoiceControlsStore((s) => s.toggleMute)
  const toggleDeafen = useVoiceControlsStore((s) => s.toggleDeafen)

  return (
    <View style={{ flexDirection: 'row' }}>
      <IconButton
        icon={muted ? 'mic-off' : 'mic'}
        label={muted ? 'Ativar microfone' : 'Silenciar microfone'}
        onPress={() => void toggleMute()}
        danger={muted}
      />
      <IconButton
        icon={deafened ? 'volume-mute' : 'headset'}
        label={deafened ? 'Desensurdecer' : 'Ensurdecer'}
        onPress={() => void toggleDeafen()}
        danger={deafened}
      />
    </View>
  )
}
