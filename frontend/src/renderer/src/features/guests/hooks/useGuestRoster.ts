import { useEffect } from 'react'
import { getCallState } from '../../call/api/calls'
import { useCallStore } from '../../call/store/callStore'
import { guestIdsOf } from '../lib/guestRoster'
import { useGuestRosterStore } from '../store/guestRosterStore'

/**
 * Mantém a lista de visitantes da call em que estou: relê o estado da call a
 * cada entrada ou saída (os dados de quem está nela trazem o guest_of).
 */
export function useGuestRoster(): void {
  const callId = useCallStore((s) => (s.type === 'channel' ? s.callId : null))
  const count = useCallStore((s) => s.participants.length)

  useEffect(() => {
    if (!callId) {
      useGuestRosterStore.getState().set([])
      return
    }
    let cancelled = false
    getCallState(callId)
      .then((state) => {
        if (!cancelled) useGuestRosterStore.getState().set(guestIdsOf(state))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [callId, count])
}
