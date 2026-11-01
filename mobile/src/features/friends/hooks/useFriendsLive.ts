import { useEffect } from 'react'
import { onRealtimeReconnect } from '../../../shared/api/realtime'
import { onWsEvent } from '../../../shared/api/ws'
import { useFriendsStore } from '../store/friendsStore'

const isFriendEvent = (type: string): boolean => type.startsWith('friend:') || type === 'relationship:blocked'

/**
 * Mantém as listas de amigos atualizadas enquanto a tela está aberta: carrega ao abrir e recarrega
 * nos eventos de amizade (o servidor não diz qual lista mudou) e ao reconectar.
 */
export function useFriendsLive(): void {
  useEffect(() => {
    void useFriendsStore.getState().load()
    const offEvents = onWsEvent((event) => {
      if (isFriendEvent(event.type)) void useFriendsStore.getState().load()
    })
    const offReconnect = onRealtimeReconnect(() => void useFriendsStore.getState().load())
    return () => {
      offEvents()
      offReconnect()
    }
  }, [])
}
