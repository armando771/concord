import { useEffect } from 'react'
import { useConnectionStore } from '../../../shared/store/connectionStore'
import { useChannelNameStore } from '../../servers/store/channelNameStore'
import { getGuestPasses } from '../api/guestInvites'
import { useGuestVisitsStore } from '../store/guestVisitsStore'

function loadVisits(): void {
  getGuestPasses()
    .then((visits) => useGuestVisitsStore.getState().set(visits))
    .catch(() => useGuestVisitsStore.getState().set(useGuestVisitsStore.getState().visits))
}

/**
 * Mantém as visitas da conta (trilho): lê ao abrir o app e quando a rede
 * volta; o resto vem pelos eventos guest:*. O nome do canal da visita vai
 * para o cache do painel "Voz conectada" (a lista de canais do servidor é
 * fechada para o visitante).
 */
export function useGuestVisitsSync(enabled: boolean): void {
  const online = useConnectionStore((s) => s.online)
  const visits = useGuestVisitsStore((s) => s.visits)

  useEffect(() => {
    if (!enabled) {
      useGuestVisitsStore.getState().reset()
      return
    }
    if (online) loadVisits()
  }, [enabled, online])

  useEffect(() => {
    for (const v of visits) {
      useChannelNameStore.getState().learn(v.server_id, [{ id: v.channel_id, name: v.channel_name }])
    }
  }, [visits])
}
