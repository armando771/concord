import type { Message } from '../api/messages'
import { applyReactionAdd, applyReactionRemove } from './emotes'

/**
 * Lista de mensagens por sala com a reação de `userId` posta (add) ou tirada
 * na mensagem `messageId` da sala `room`. As outras salas e mensagens ficam
 * como estavam.
 */
export function withReaction(
  byRoom: Record<string, Message[]>,
  room: string,
  messageId: string,
  emoji: string,
  userId: string,
  add: boolean
): Record<string, Message[]> {
  const apply = add ? applyReactionAdd : applyReactionRemove
  return {
    ...byRoom,
    [room]: (byRoom[room] ?? []).map((m) =>
      m.id === messageId ? { ...m, reactions: apply(m.reactions, emoji, userId) } : m
    )
  }
}
