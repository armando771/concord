import VoiceSettings from '../../../call/components/VoiceSettings'
import { DesktopSettings, NotificationSettings } from '../AppSettings'

/** Configurações → Voz e áudio: microfone, saída, RNNoise e teste. */
export function VoiceSection(): React.JSX.Element {
  return <VoiceSettings />
}

/** Configurações → Notificações. */
export function NotificationsSection(): React.JSX.Element {
  return <NotificationSettings />
}

/** Configurações → Aplicativo: iniciar com o sistema e overlay. */
export function AppSection(): React.JSX.Element {
  return <DesktopSettings />
}
