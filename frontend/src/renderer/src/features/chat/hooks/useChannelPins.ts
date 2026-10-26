import { useEffect } from 'react'
import { selectPins, usePinStore } from '../store/pinStore'
import type { PinnedMessage } from '../api/messages'
import { channelIdOf } from '../lib/chatPaneView'

/** Fixadas do canal da sala (carregadas ao abrir); DM e grupo não têm. */
export function useChannelPins(room: string): {
  channelId: string | null
  pins: PinnedMessage[]
} {
  const channelId = channelIdOf(room)
  // selectPins: sem fixadas devolve sempre o mesmo array (senão: React #185).
  const pins = usePinStore(selectPins(channelId ?? ''))
  const loadPins = usePinStore((s) => s.loadPins)

  useEffect(() => {
    if (channelId) {
      void loadPins(channelId)
    }
  }, [channelId, loadPins])

  return { channelId, pins }
}
