import { useCallback, useEffect, useRef } from 'react'
import { useChatStore } from '../../store/chatStore'
import {
  IDLE_TYPING,
  typingOnDone,
  typingOnInput,
  type TypingSender,
  type TypingSignal
} from '../../lib/typing'

function sendSignal(room: string, signal: TypingSignal): void {
  if (!signal) return
  useChatStore.getState().sendEvent(signal === 'typing' ? 'typing' : 'typing:stop', { room })
}

/**
 * Avisa a sala que estou digitando: na primeira tecla e depois no máximo a
 * cada 3 s. Campo apagado, mensagem enviada ou troca de sala mandam stop.
 */
export function useTypingSender(room: string): {
  onDraftChange: (text: string) => void
  onSent: () => void
} {
  const state = useRef<TypingSender>(IDLE_TYPING)

  useEffect(() => {
    return () => {
      const { signal } = typingOnDone(state.current)
      state.current = IDLE_TYPING
      sendSignal(room, signal)
    }
  }, [room])

  const onDraftChange = useCallback(
    (text: string) => {
      const next = typingOnInput(state.current, text, Date.now())
      state.current = next.state
      sendSignal(room, next.signal)
    },
    [room]
  )

  const onSent = useCallback(() => {
    const { signal } = typingOnDone(state.current)
    state.current = IDLE_TYPING
    sendSignal(room, signal)
  }, [room])

  return { onDraftChange, onSent }
}
