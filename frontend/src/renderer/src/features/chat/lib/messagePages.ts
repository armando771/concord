import { MESSAGE_LIMIT, type Message } from '../api/messages'
import { mergeMessages } from './messageOrder'

/** As listas por sala que uma página da API atualiza. */
export interface RoomPages {
  messagesByRoom: Record<string, Message[]>
  hasMoreByRoom: Record<string, boolean>
}

/**
 * Junta uma página da API (a inicial ou uma antiga) à lista da sala. Página
 * cheia: pode haver mais; incompleta ou vazia: acabou o histórico.
 */
export function withMessagePage(
  state: RoomPages,
  room: string,
  page: Message[],
  limit = MESSAGE_LIMIT
): RoomPages {
  return {
    messagesByRoom: {
      ...state.messagesByRoom,
      // Pode já ter mensagem ao vivo que chegou durante o carregamento.
      [room]: mergeMessages(state.messagesByRoom[room] ?? [], page)
    },
    hasMoreByRoom: { ...state.hasMoreByRoom, [room]: page.length >= limit }
  }
}
