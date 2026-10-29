import {
  addChannelReaction,
  addConversationReaction,
  removeChannelReaction,
  removeConversationReaction
} from './messages'

/** Põe (add) ou tira a minha reação numa mensagem da sala (canal, DM ou grupo). */
export function sendReaction(
  room: string,
  messageId: string,
  emoji: string,
  add: boolean
): Promise<void> {
  if (room.startsWith('channel:')) {
    const channelId = room.slice('channel:'.length)
    const call = add ? addChannelReaction : removeChannelReaction
    return call(channelId, messageId, emoji)
  }
  const conversationId = room.slice('conversation:'.length)
  const call = add ? addConversationReaction : removeConversationReaction
  return call(conversationId, messageId, emoji)
}
