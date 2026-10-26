import { useEffect, useState } from 'react'
import { getOrCreateConversationWith } from '../api/conversations'
import { openDm } from '../lib/openDm'
import { useChatStore } from '../store/chatStore'
import { showToast } from '../../../shared/store/toastStore'

/** Abre (ou cria) a DM com a pessoa da rota e devolve o id da conversa ou o erro. */
export function useDmConversation(userId: string | undefined): {
  conversationId: string | null
  error: string | null
} {
  const fetchConversations = useChatStore((s) => s.fetchConversations)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void openDm(userId, {
      get: getOrCreateConversationWith,
      isCancelled: () => cancelled,
      onOpened: (_userId, id) => {
        setConversationId(id)
        // Conversa nova (ex.: alguém do servidor que não é amigo): atualiza a
        // lista para o nome dela aparecer no topo e na barra lateral.
        void fetchConversations()
      },
      onFailed: (_userId, message) => {
        setError(message)
        showToast.error('Não foi possível abrir a conversa.')
      }
    })
    return () => {
      cancelled = true
    }
  }, [userId, fetchConversations])

  return { conversationId, error }
}
