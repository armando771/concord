// Transformações puras da lista de mensagens por sala (e da prévia das DMs)
// usadas pelo chatStore: pelas ações da própria pessoa e pelos eventos do WS.
import type { Message, Poll } from '../api/messages'
import type { ConversationSummary } from '../api/conversations'
import { applyMessageUpdate } from './messageEdit'
import { messagePreview } from './polls'

export type MessagesByRoom = Record<string, Message[]>

interface RoomMessagesState {
  messagesByRoom: MessagesByRoom
  conversations: ConversationSummary[]
}

/** Tira a mensagem apagada e a citação dela nas respostas. */
export const clearDeletedReplyTarget = (messages: Message[], deletedId: string): Message[] =>
  messages
    .filter((m) => m.id !== deletedId)
    .map((m) => (m.reply_to_id === deletedId ? { ...m, reply_to: null } : m))

/** Troca a mensagem `messageId` da sala por `next(mensagem)` (a sala vira lista, se não tinha). */
export const mapRoomMessage = (
  messagesByRoom: MessagesByRoom,
  room: string,
  messageId: string,
  next: (message: Message) => Message
): MessagesByRoom => ({
  ...messagesByRoom,
  [room]: (messagesByRoom[room] ?? []).map((m) => (m.id === messageId ? next(m) : m))
})

/** A prévia da DM, quando a mensagem editada é a última da conversa. */
function withEditedPreview(
  conversations: ConversationSummary[],
  msg: Message
): ConversationSummary[] | null {
  const idx = conversations.findIndex(
    (c) => c.id === msg.conversation_id && c.last_message?.id === msg.id
  )
  if (idx === -1) return null
  const next = [...conversations]
  const conv = next[idx]
  next[idx] = { ...conv, last_message: { ...conv.last_message!, content: messagePreview(msg) } }
  return next
}

/**
 * Aplica uma mensagem editada à sala (se carregada) e à prévia da DM, quando
 * ela é a última da conversa. Não mexe em não lidas nem notifica: editar não
 * é mensagem nova.
 */
export const withUpdatedMessage = (
  state: RoomMessagesState,
  room: string,
  msg: Message
): Partial<RoomMessagesState> => {
  const next: Partial<RoomMessagesState> = {}
  const current = state.messagesByRoom[room]
  const updated = current && applyMessageUpdate(current, msg)
  if (updated && updated !== current)
    next.messagesByRoom = { ...state.messagesByRoom, [room]: updated }
  const conversations = msg.conversation_id ? withEditedPreview(state.conversations, msg) : null
  if (conversations) next.conversations = conversations
  return next
}

/** Troca a enquete de uma mensagem carregada na sala (sem efeito se não estiver). */
export const replacePoll = (
  messagesByRoom: MessagesByRoom,
  room: string,
  messageId: string,
  next: (current: Poll | null | undefined) => Poll
): MessagesByRoom => {
  const messages = messagesByRoom[room]
  if (!messages?.some((m) => m.id === messageId)) return messagesByRoom
  return {
    ...messagesByRoom,
    [room]: messages.map((m) => (m.id === messageId ? { ...m, poll: next(m.poll) } : m))
  }
}
