import type { ConversationSummary } from '../api/conversations'
import type { Message } from '../api/messages'

/** O chat aberto agora (canal ou conversa); null = nenhum. */
export interface ActiveRoom {
  kind: 'channel' | 'conversation'
  id: string
}

/** Conta como não lida: mensagem de outra pessoa num chat que não está aberto. */
export function shouldCountUnread(message: Message, myId: string | undefined, active: ActiveRoom | null): boolean {
  if (message.author_id === myId) return false
  if (!active) return true
  const id = active.kind === 'channel' ? message.channel_id : message.conversation_id
  return id !== active.id
}

export const totalUnread = (conversations: ConversationSummary[]): number =>
  conversations.reduce((sum, c) => sum + c.unread_count, 0)

/** Texto do selo: 99+ para não estourar o círculo. */
export const badgeText = (count: number): string => (count > 99 ? '99+' : String(count))

/** Rótulo para leitor de tela. */
export const unreadLabel = (count: number): string =>
  count === 1 ? '1 mensagem não lida' : `${count} mensagens não lidas`
