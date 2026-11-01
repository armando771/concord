// Despachante dos eventos do WS: cada tipo vai para o tratador da sua área
// (os de outras features, para o store dono). Ver handleWsEvent no chatStore.
import type { WsEvent } from '../../../../shared/api/ws'
import type { ChatWsContext, Payload, WsHandler } from './context'
import { delegateWsEvent } from './delegates'
import { handleMessageCreate } from './messageCreate'
import { MESSAGE_HANDLERS } from './messages'
import { CHANNEL_HANDLERS } from './channels'
import { handleRoleEvent, SERVER_HANDLERS } from './servers'
import { PEOPLE_HANDLERS } from './people'
import { CONVERSATION_HANDLERS } from './conversations'
import { handleStickerEvent } from './stickers'

const CHAT_HANDLERS = new Map<string, WsHandler>(
  Object.entries({
    'message:create': handleMessageCreate,
    ...MESSAGE_HANDLERS,
    ...CHANNEL_HANDLERS,
    ...SERVER_HANDLERS,
    ...PEOPLE_HANDLERS,
    ...CONVERSATION_HANDLERS
  })
)

export function dispatchWsEvent(event: WsEvent, ctx: ChatWsContext): void {
  if (delegateWsEvent(event)) return
  const handler = CHAT_HANDLERS.get(event.type)
  if (handler) return handler((event.payload ?? {}) as Payload, ctx, event)
  if (!handleRoleEvent(event, ctx)) handleStickerEvent(event, ctx)
}
