import { useCallStore } from '../../call/store/callStore'
import { useDraftStore } from '../../chat/store/draftStore'
import { useSearchStore } from '../../chat/store/searchStore'

/**
 * O que não pode passar de uma conta para a próxima: a chamada (microfone e
 * LiveKit), a busca de mensagens e os rascunhos. Roda ao sair da conta e
 * também quando a sessão se perde (refresh do token falhou). A chamada vai
 * primeiro: o aviso de saída (call:leave) ainda precisa do WebSocket aberto.
 */
export function endSessionState(): void {
  useCallStore.getState().endCall()
  useSearchStore.getState().close()
  useDraftStore.getState().clear()
}
