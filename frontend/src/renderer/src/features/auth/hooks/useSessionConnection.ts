import { useEffect } from 'react'
import { useChatStore } from '../../chat/store/chatStore'
import { endSessionState } from '../store/sessionEnd'

/**
 * Liga o tempo real enquanto há sessão. Ao perdê-la (sair da conta ou o token
 * expirar), encerra a chamada e limpa o que era da conta, antes de fechar o
 * WebSocket.
 */
export function useSessionConnection(hasToken: boolean): void {
  useEffect(() => {
    if (hasToken) useChatStore.getState().connect()
    return () => {
      endSessionState()
      useChatStore.getState().disconnect()
    }
  }, [hasToken])
}
