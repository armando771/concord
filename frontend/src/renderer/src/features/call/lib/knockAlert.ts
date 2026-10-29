// Aviso de quem bate na porta da sala trancada em que estou: som e notificação
// do sistema, que respeitam o mudo, o ensurdecer e as preferências de notificação
// ("Não perturbe" incluso). O pedido na tela (JoinRequestsStack) é à parte e
// aparece sempre, para ninguém ficar sem resposta.
import { useAuthStore } from '../../auth/store/authStore'
import { prefsForStatus } from '../../friends/lib/presenceStatus'
import {
  deliverDesktop,
  desktopPayload,
  knockNotification,
  type DesktopPayload,
  type NotificationPrefs
} from '../../notifications/lib/notifications'
import { notificationPrefs } from '../../notifications/store/notificationPrefsStore'
import { playSound } from './sounds'

/** Sons da sala trancada (batida, trancar, destrancar): calados com mudo ou ensurdecido (#360). */
export function roomSoundAllowed({
  muted,
  deafened
}: {
  muted: boolean
  deafened: boolean
}): boolean {
  return !muted && !deafened
}

export interface KnockAlertContext {
  muted: boolean
  deafened: boolean
  prefs: NotificationPrefs
  serverId: string | null
  channelId: string | null
}

export interface KnockAlert {
  /** Toca o som da batida? */
  sound: boolean
  /** Aviso nativo (null = nenhum: toast e barra de tarefas desligados). */
  payload: DesktopPayload | null
}

export function knockAlert(
  requester: { display_name: string; username: string },
  { muted, deafened, prefs, serverId, channelId }: KnockAlertContext
): KnockAlert {
  const payload = desktopPayload(knockNotification(requester, serverId, channelId), prefs)
  return {
    sound: prefs.sound && roomSoundAllowed({ muted, deafened }),
    payload: payload.toast || payload.taskbar ? payload : null
  }
}

/** Liga o aviso às preferências salvas e ao status da pessoa. */
export function deliverKnockAlert(
  requester: { display_name: string; username: string },
  ctx: Omit<KnockAlertContext, 'prefs'>
): void {
  const prefs = prefsForStatus(notificationPrefs(), useAuthStore.getState().user?.status)
  const alert = knockAlert(requester, { ...ctx, prefs })
  if (alert.sound) playSound('knock')
  if (alert.payload) deliverDesktop(alert.payload)
}
