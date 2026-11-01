import { session } from './session'
import { WsClient } from './ws'

const reconnectListeners = new Set<() => void>()

/** Avisa quando a conexão volta depois de uma queda (não na primeira abertura): quem
 *  mostra dados em tempo real refaz a busca para cobrir o que se perdeu. */
export function onRealtimeReconnect(listener: () => void): () => void {
  reconnectListeners.add(listener)
  return () => reconnectListeners.delete(listener)
}

const openListeners = new Set<() => void>()

/** Avisa a cada abertura da conexão, a primeira inclusive (a presença na chamada precisa de todas). */
export function onRealtimeOpen(listener: () => void): () => void {
  openListeners.add(listener)
  return () => openListeners.delete(listener)
}

/**
 * Conexão única do app com o servidor em tempo real. As features não tratam
 * eventos aqui: se inscrevem com `onWsEvent` (ws.ts).
 */
export const realtime = new WsClient({
  getToken: () => session().tokens().accessToken,
  getUserId: () => session().userId(),
  onEvent: () => {},
  onOpen: (reconnected) => {
    openListeners.forEach((listener) => listener())
    if (reconnected) reconnectListeners.forEach((listener) => listener())
  }
})
