// Aviso fora de mensagem (pedido de amizade, menção em proposta): notificação
// do sistema e som, que o "Não perturbe" silencia.
import { useAuthStore } from '../../../auth/store/authStore'
import {
  notificationSound,
  notifyDesktop,
  type AppNotification
} from '../../../notifications/lib/notifications'
import { notificationPrefs } from '../../../notifications/store/notificationPrefsStore'
import { prefsForStatus } from '../../../friends/lib/presenceStatus'
import { playSound } from '../../../call/lib/sounds'

export function ping(notification: AppNotification): void {
  const prefs = prefsForStatus(notificationPrefs(), useAuthStore.getState().user?.status)
  notifyDesktop(notification, prefs)
  const sound = notificationSound(notification.kind, prefs)
  if (sound) playSound(sound)
}
