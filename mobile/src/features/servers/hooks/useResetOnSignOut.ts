import { useEffect } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { useActiveRoomStore } from '../../chat/store/activeRoomStore'
import { useConversationsStore } from '../../chat/store/conversationsStore'
import { useUnreadStore } from '../../chat/store/unreadStore'
import { useFriendsStore } from '../../friends/store/friendsStore'
import { usePresenceStore } from '../../friends/store/presenceStore'
import { useSelectedServerStore } from '../store/selectedServerStore'
import { useServersStore } from '../store/serversStore'

/** Ao sair da conta, apaga servidores, canais, conversas, amigos, presença, não lidas e a seleção: nada vaza para a próxima conta. */
export function useResetOnSignOut(): void {
  const signedOut = useAuthStore((s) => s.status === 'signedOut')
  useEffect(() => {
    if (!signedOut) return
    useServersStore.getState().reset()
    useConversationsStore.getState().reset()
    usePresenceStore.getState().reset()
    useFriendsStore.getState().reset()
    useUnreadStore.getState().reset()
    useActiveRoomStore.getState().setActive(null)
    useSelectedServerStore.getState().select(null)
  }, [signedOut])
}
