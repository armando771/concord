import VoiceSettings from '../../../call/components/VoiceSettings'
import TTSSettings from '../../../tts/components/TTSSettings'
import { DesktopSettings, NotificationSettings } from '../AppSettings'

/** Configurações → Voz e áudio: microfone, saída, RNNoise, teste e mensagens TTS. */
export function VoiceSection(): React.JSX.Element {
  return (
    <div className="space-y-4">
      <VoiceSettings />
      <TTSSettings />
    </div>
  )
}

/** Configurações → Notificações. */
export function NotificationsSection(): React.JSX.Element {
  return <NotificationSettings />
}

/** Configurações → Aplicativo: iniciar com o sistema e overlay. */
export function AppSection(): React.JSX.Element {
  return <DesktopSettings />
}
