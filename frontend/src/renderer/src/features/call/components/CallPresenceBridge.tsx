import { useEffect } from 'react'
import { useCallStore } from '../store/callStore'
import { useChatStore } from '../../chat/store/chatStore'
import { useConnectionStore } from '../../../shared/store/connectionStore'
import { useCallResumeStore } from '../../updates/store/callResumeStore'
import { createPresenceReporter } from '../lib/callPresence'

/** Diz ao servidor em que call o app está a cada conexão do WS (ver lib/callPresence). */
function CallPresenceBridge(): null {
  useEffect(() => {
    const reporter = createPresenceReporter({
      read: () => {
        const call = useCallStore.getState()
        return {
          wsOpen: useConnectionStore.getState().ws.phase === 'open',
          resumeSettled: useCallResumeStore.getState().settled,
          status: call.status,
          callId: call.callId
        }
      },
      send: (callId) => useChatStore.getState().sendEvent('call:presence', { call_id: callId })
    })
    if (useConnectionStore.getState().ws.phase === 'open') reporter.opened()
    const offWs = useConnectionStore.subscribe((state, previous) => {
      if (state.ws.phase === 'open' && previous.ws.phase !== 'open') reporter.opened()
    })
    const offCall = useCallStore.subscribe(reporter.update)
    const offResume = useCallResumeStore.subscribe(reporter.update)
    return () => {
      offWs()
      offCall()
      offResume()
    }
  }, [])
  return null
}

export default CallPresenceBridge
