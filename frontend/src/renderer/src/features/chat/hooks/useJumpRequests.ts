import { useEffect, useEffectEvent } from 'react'
import { useSearchStore } from '../store/searchStore'
import { jumpEventTarget, readyJump } from '../lib/chatPaneView'

/**
 * Pedidos de pular até uma mensagem que vêm de fora do chat: o clique num
 * resultado da busca (quando a sala já carregou) e o evento
 * `concord:jump-to-message` (ex.: notificação, fixadas).
 */
export function useJumpRequests({
  room,
  loading,
  onJump
}: {
  room: string
  loading: boolean
  onJump: (messageId: string) => void
}): void {
  const jump = useEffectEvent(onJump)

  const pendingJump = useSearchStore((s) => s.pendingJump)
  useEffect(() => {
    const messageId = readyJump(pendingJump, room, loading)
    if (!messageId) return
    useSearchStore.getState().clearJump()
    jump(messageId)
  }, [pendingJump, room, loading])

  useEffect(() => {
    const onEvent = (e: Event): void => {
      const messageId = jumpEventTarget(e)
      if (messageId) jump(messageId)
    }
    window.addEventListener('concord:jump-to-message', onEvent)
    return () => window.removeEventListener('concord:jump-to-message', onEvent)
  }, [room])
}
