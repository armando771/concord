import type { Message } from '../api/messages'
import { everyonePingsMe, mentionsUser } from './mentions'
import { messagePreview } from './polls'
import type { ChosenStatus } from './presenceStatus'
import type { SoundName } from './sounds'

/** De onde veio o aviso: decide o som e o que as preferências controlam. */
export type NotificationKind = 'message' | 'mention' | 'call' | 'friend_request'

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

/**
 * Notificação para uma DM recebida (mensagens de canal não notificam). Em DM
 * em grupo, o título leva o nome do grupo e o clique abre o grupo.
 */
export function messageNotification(
  message: Message,
  meId: string,
  group?: { name: string }
): AppNotification | null {
  if (!message.conversation_id || message.author_id === meId) return null
  const author = message.author?.display_name || message.author?.username || 'Nova mensagem'
  return {
    kind: 'message',
    title: group ? `${author} em ${group.name}` : author,
    body: truncate(messagePreview(message)),
    route: group ? `/dm/c/${message.conversation_id}` : `/dm/${message.author_id}`
  }
}

/** Pedido de amizade recebido: abre a aba Pendentes. */
export function friendRequestNotification(requester: {
  display_name: string
  username: string
}): AppNotification {
  return {
    kind: 'friend_request',
    title: 'Pedido de amizade',
    body: `${requester.display_name || requester.username} quer ser seu amigo`,
    route: '/friends?tab=pending'
  }
}

/**
 * Notificação para uma mensagem de canal que menciona você (@nick), responde
 * sua mensagem ou pinga o canal (@all/@here, pelo mention_everyone que o
 * backend liberou). `status` é o escolhido por você: @here não pinga ausente.
 */
export function mentionNotification(
  message: Message,
  me: { id: string; username: string; status?: ChosenStatus },
  serverId: string | null
): AppNotification | null {
  if (!message.channel_id || !serverId || message.author_id === me.id) return null
  const isReplyToMe = message.reply_to?.author_id === me.id
  const isMention = mentionsUser(message.content, me.username)
  const everyone = everyonePingsMe(message.mention_everyone, me.status)
    ? message.mention_everyone
    : null
  if (!isMention && !isReplyToMe && !everyone) return null
  const author = message.author?.display_name || message.author?.username || 'Alguém'
  return {
    kind: 'mention',
    // Aviso do próprio servidor (ex.: aniversário) não é "Fulano mencionou você".
    title:
      message.system_kind === 'birthday'
        ? '🎂 Feliz aniversário!'
        : isMention
          ? `${author} mencionou você`
          : isReplyToMe
            ? `${author} respondeu você`
            : `${author} mencionou @${everyone}`,
    body: truncate(messagePreview(message)),
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
  return kind === 'mention' ? 'mention' : 'message'
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

type DesktopNotifier = (payload: DesktopPayload) => void

/** No navegador quem mostra o aviso é o WebNotificationBridge. */
let webNotifier: DesktopNotifier | null = null

/** Liga (ou desliga, com null) o aviso do build web. */
export function setWebNotifier(notifier: DesktopNotifier | null): void {
  webNotifier = notifier
}

/**
 * Pede ao processo main uma notificação nativa. Fora do Electron, vai para o
 * aviso do navegador, se o build web ligou um (senão é no-op).
 */
export function notifyDesktop(
  notification: AppNotification,
  prefs: NotificationPrefs = DEFAULT_NOTIFICATION_PREFS
): void {
  if (typeof window === 'undefined') return
  const payload = desktopPayload(notification, prefs)
  const background = window.api?.background
  if (background) background.notify(payload)
  else webNotifier?.(payload)
}
