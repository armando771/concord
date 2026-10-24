import type { Message } from '../api/messages'
import { mentionsUser } from './mentions'

export interface AppNotification {
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
    title: `${caller.display_name || caller.username} está te ligando`,
    body: 'Chamada de voz — clique para atender',
    route: `/dm/${caller.id}`,
    urgent: true
  }
}

/** Pede ao processo main uma notificação nativa (no-op fora do Electron). */
export function notifyDesktop(notification: AppNotification): void {
  if (typeof window === 'undefined') return
  window.api?.background?.notify(notification)
}
