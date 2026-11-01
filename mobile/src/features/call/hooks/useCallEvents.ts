import { useEffect } from 'react'
import { onRealtimeReconnect } from '../../../shared/api/realtime'
import { onWsEvent } from '../../../shared/api/ws'
import { useAuthStore } from '../../auth/store/authStore'
import { getCallState } from '../api/calls'
import { handleCallEvent } from '../lib/callEvents'
import { resyncCall } from '../lib/callResync'
import { useCallSessionStore } from '../store/callSessionStore'

const meId = (): string | null => useAuthStore.getState().user?.id ?? null

/** Eventos `call:*` do servidor viram estado; ao reconectar o WebSocket a lista é refeita pela API. */
export function useCallEvents(): void {
  const signedIn = useAuthStore((s) => s.status === 'signedIn')

  useEffect(() => {
    if (!signedIn) return
    const offEvents = onWsEvent((event) => handleCallEvent(event, meId()))
    const offReconnect = onRealtimeReconnect(() => {
      void resyncCall({
        getState: getCallState,
        meId: meId(),
        onEnded: () => handleCallEvent({ type: 'call:ended', payload: { call_id: useCallSessionStore.getState().callId } }, meId())
      })
    })
    return () => {
      offEvents()
      offReconnect()
    }
  }, [signedIn])
}
