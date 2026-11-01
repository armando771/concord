// O que os tratadores de eventos do WS precisam do chatStore. O store monta
// isto (ver handleWsEvent); os testes passam um falso.
import type { WsEvent } from '../../../../shared/api/ws'
import type { Message } from '../../api/messages'
import type { ChatState, RoomKey } from '../chatStore'

export interface ChatWsContext {
  set: (next: (state: ChatState) => Partial<ChatState>) => void
  get: () => ChatState
  /** A sala tem um ChatPane aberto (só essas guardam lista de mensagens). */
  isRoomOpen: (room: RoomKey) => boolean
  /** Esquece a sala aberta e sai dela no WS. */
  dropRoom: (room: RoomKey) => void
  /** Eco de uma mensagem minha: tira a pendente, se a resposta do POST ainda não tirou. */
  settleEcho: (room: RoomKey, msg: Message) => void
  /** true só na primeira vez (a mesma mensagem chega pela sala do canal e do servidor). */
  claimNotification: (messageId: string) => boolean
  /** Marca a DM como lida no servidor, juntando rajadas. */
  markReadSoon: (conversationId: string, messageId?: string) => void
}

export type Payload = Record<string, unknown>

/** Tratador de um tipo de evento do chat. */
export type WsHandler = (payload: Payload, ctx: ChatWsContext, event: WsEvent) => void

/** Sala do evento: o canal, senão a conversa. */
export const roomKeyOf = (
  channelId: string | null | undefined,
  conversationId: string | null | undefined
): RoomKey => (channelId ? `channel:${channelId}` : `conversation:${conversationId}`)
