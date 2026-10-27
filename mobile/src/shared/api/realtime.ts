import { session } from './session'
import { WsClient } from './ws'

/**
 * Conexão única do app com o servidor em tempo real. As features não tratam
 * eventos aqui: se inscrevem com `onWsEvent` (ws.ts).
 */
export const realtime = new WsClient({
  getToken: () => session().tokens().accessToken,
  getUserId: () => session().userId(),
  onEvent: () => {}
})
