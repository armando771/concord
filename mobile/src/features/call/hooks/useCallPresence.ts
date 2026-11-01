import { useEffect } from 'react'
import { onRealtimeOpen, realtime } from '../../../shared/api/realtime'
import { useAuthStore } from '../../auth/store/authStore'
import { createPresenceReporter } from '../lib/callPresence'
import { useCallSessionStore } from '../store/callSessionStore'

/** Diz ao servidor em que chamada estou a cada conexão do WebSocket (ADR 0018): ele tira quem não está na mídia. */
export function useCallPresence(): void {
  const signedIn = useAuthStore((s) => s.status === 'signedIn')

  useEffect(() => {
    if (!signedIn) return
    const reporter = createPresenceReporter({
      read: () => {
        const { phase, callId } = useCallSessionStore.getState()
        return { wsOpen: realtime.isConnected(), phase, callId }
      },
      send: (callId) => realtime.sendEvent('call:presence', { call_id: callId })
    })
    if (realtime.isConnected()) reporter.opened()
    const offOpen = onRealtimeOpen(reporter.opened)
    const offSession = useCallSessionStore.subscribe(reporter.update)
    return () => {
      offOpen()
      offSession()
    }
  }, [signedIn])
}
