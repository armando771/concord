import { useEffect } from 'react'
import { onRealtimeReconnect, realtime } from '../../../shared/api/realtime'
import { onWsEvent } from '../../../shared/api/ws'
import { useAuthStore } from '../../auth/store/authStore'
import { useServersStore } from '../../servers/store/serversStore'
import type { Message } from '../api/messages'
import { shouldCountUnread } from '../lib/unreadCounts'
import { useActiveRoomStore } from '../store/activeRoomStore'
import { useConversationsStore } from '../store/conversationsStore'
import { useUnreadStore } from '../store/unreadStore'

type Payload = { message?: Message; server_id?: string } | null

/**
 * Mantém as não lidas em dia com o app logado (não só nas telas de DM): carrega as conversas,
 * assina a sala de cada servidor (é por onde chegam as mensagens de canal) e conta as mensagens
 * de outras pessoas nos chats que não estão abertos.
 */
export function useUnreadLive(): void {
  const signedIn = useAuthStore((s) => s.status === 'signedIn')
  const servers = useServersStore((s) => s.servers)
  const load = useConversationsStore((s) => s.load)

  useEffect(() => {
    if (!signedIn) return
    void load()
    return onRealtimeReconnect(() => void load())
  }, [signedIn, load])

  useEffect(() => {
    if (signedIn) servers.forEach((server) => realtime.subscribe(`server:${server.id}`))
  }, [signedIn, servers])

  useEffect(
    () =>
      !signedIn
        ? undefined
        : onWsEvent((event) => {
          const payload = event.payload as Payload
          const message = payload?.message
          if (event.type !== 'message:create' || !message) return
          const myId = useAuthStore.getState().user?.id
          const active = useActiveRoomStore.getState().active
          if (message.conversation_id) {
            void useConversationsStore.getState().applyMessage(message, { myId, active })
          } else if (message.channel_id && shouldCountUnread(message, myId, active)) {
            useUnreadStore.getState().add(message.channel_id, payload?.server_id)
          }
        }),
    [signedIn]
  )
}
