import { useEffect, useState } from 'react'
import { getOrCreateConversationWith } from '../api/conversations'
import { dmFailed, dmOpened, dmOpenedFor, type DmOpened, type DmOpenState } from '../lib/dmOpened'
import { openDm } from '../lib/openDm'
import { useChatStore } from '../store/chatStore'
import { showToast } from '../../../shared/store/toastStore'

/** Abre (ou cria) a DM com a pessoa da rota e devolve o id da conversa ou o erro. */
export function useDmConversation(userId: string | undefined): DmOpenState {
  const fetchConversations = useChatStore((s) => s.fetchConversations)
  // Guardado com a pessoa para quem foi pedido: a rota reaproveita esta tela, e
  // a conversa (ou o erro) da pessoa anterior não vale para a nova.
  const [opened, setOpened] = useState<DmOpened | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    void openDm(userId, {
      get: getOrCreateConversationWith,
      isCancelled: () => cancelled,
      onOpened: (forUser, id) => {
        setOpened(dmOpened(forUser, id))
        // Conversa nova (ex.: alguém do servidor que não é amigo): atualiza a
        // lista para o nome dela aparecer no topo e na barra lateral.
        void fetchConversations()
      },
      onFailed: (forUser, message) => {
        setOpened(dmFailed(forUser, message))
        showToast.error('Não foi possível abrir a conversa.')
      }
    })
    return () => {
      cancelled = true
    }
  }, [userId, fetchConversations])

  return dmOpenedFor(opened, userId)
}
