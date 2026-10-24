import type { Message } from '../api/messages'

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
