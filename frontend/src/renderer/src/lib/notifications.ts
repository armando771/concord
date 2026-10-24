import type { Message } from '../api/messages'
import { mentionsUser } from './mentions'
import type { SoundName } from './sounds'

/** De onde veio o aviso: decide o som e o que as preferências controlam. */
export type NotificationKind = 'message' | 'mention' | 'call'

/** Preferências de notificação do usuário (Configurações → Notificações). */
export interface NotificationPrefs {
  /** Toast nativo do Windows. */
  desktop: boolean
  /** Piscar o botão e mostrar o selo de não lidas na barra de tarefas. */
  taskbar: boolean
  /** Som ao receber DM ou menção. */
  sound: boolean
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  desktop: true,
  taskbar: true,
  sound: true
}

export interface AppNotification {
  kind: NotificationKind
  title: string
  body: string
  /** Rota aberta ao clicar na notificação. */
  route: string
  /** Pisca a janela na barra de tarefas (chamada recebida). */
  urgent?: boolean
}

const MAX_BODY = 140

function truncate(text: string): string {
  return text.length > MAX_BODY ? `${text.slice(0, MAX_BODY - 1)}…` : text
}

/** Notificação para uma DM recebida (mensagens de canal não notificam). */
export function messageNotification(message: Message, meId: string): AppNotification | null {
  if (!message.conversation_id || message.author_id === meId) return null
  return {
    kind: 'message',
    title: message.author?.display_name || message.author?.username || 'Nova mensagem',
    body: truncate(message.content),
    route: `/dm/${message.author_id}`
  }
}

/** Notificação para uma mensagem de canal que menciona você (@nick). */
export function mentionNotification(
  message: Message,
  me: { id: string; username: string },
  serverId: string | null
): AppNotification | null {
  if (!message.channel_id || !serverId || message.author_id === me.id) return null
  if (!mentionsUser(message.content, me.username)) return null
  const author = message.author?.display_name || message.author?.username || 'Alguém'
  return {
    kind: 'mention',
    title: `${author} mencionou você`,
    body: truncate(message.content),
    route: `/servers/${serverId}/channels/${message.channel_id}`
  }
}

export function callNotification(caller: {
  id: string
  display_name: string
  username: string
}): AppNotification {
  return {
    kind: 'call',
    title: `${caller.display_name || caller.username} está te ligando`,
    body: 'Chamada de voz — clique para atender',
    route: `/dm/${caller.id}`,
    urgent: true
  }
}

/** Som do aviso (null = sem som). Chamada tem toque próprio no callStore. */
export function notificationSound(
  kind: NotificationKind,
  prefs: Pick<NotificationPrefs, 'sound'>
): SoundName | null {
  if (!prefs.sound || kind === 'call') return null
  return kind === 'message' ? 'message' : 'mention'
}

export interface DesktopPayload {
  title: string
  body: string
  route: string
  urgent?: boolean
  toast: boolean
  taskbar: boolean
}

/**
 * O que vai para o processo main. Chamada recebida ignora as preferências:
 * sempre mostra o toast e pisca a barra de tarefas, como antes.
 */
export function desktopPayload(
  notification: AppNotification,
  prefs: NotificationPrefs
): DesktopPayload {
  const { title, body, route, urgent } = notification
  return {
    title,
    body,
    route,
    ...(urgent ? { urgent } : {}),
    toast: urgent ? true : prefs.desktop,
    taskbar: urgent ? true : prefs.taskbar
  }
}

/** Pede ao processo main uma notificação nativa (no-op fora do Electron). */
export function notifyDesktop(
  notification: AppNotification,
  prefs: NotificationPrefs = DEFAULT_NOTIFICATION_PREFS
): void {
  if (typeof window === 'undefined') return
  window.api?.background?.notify(desktopPayload(notification, prefs))
}
