// DMs e grupos: criados, alterados, lidos em outro aparelho ou deixados.
import type { WsHandler } from './context'
import { router } from '../../../../app/router'

const refetch: WsHandler = (payload, ctx) => {
  if (payload.conversation_id) void ctx.get().fetchConversations()
}

const handleRead: WsHandler = (payload, ctx) => {
  const conversationId = payload.conversation_id as string | undefined
  if (!conversationId) return
  ctx.set((state) => ({
    unreadByRoom: { ...state.unreadByRoom, [`conversation:${conversationId}`]: 0 }
  }))
}

const handleRemove: WsHandler = (payload, ctx) => {
  const conversationId = payload.conversation_id as string | undefined
  if (!conversationId) return
  const room = `conversation:${conversationId}`
  const wasGroup = ctx
    .get()
    .conversations.some((c) => c.id === conversationId && c.type === 'group')
  ctx.set((state) => ({
    conversations: state.conversations.filter((c) => c.id !== conversationId),
    unreadByRoom: { ...state.unreadByRoom, [room]: 0 }
  }))
  // Saiu do grupo (ou foi removido) com ele aberto: volta para Amigos.
  if (wasGroup && ctx.get().activeRoom === room) {
    ctx.get().closeRoom(room)
    void router.navigate('/friends')
  }
}

export const CONVERSATION_HANDLERS: Record<string, WsHandler> = {
  'conversation:create': refetch,
  'conversation:update': refetch,
  'conversation:read': handleRead,
  'conversation:remove': handleRemove
}
