import { onWsEvent } from '../../../shared/api/ws'
import { usePresenceActivityStore } from '../store/presenceActivityStore'
import { handlePresenceActivityEvent, type PresenceActivityEventDeps } from './presenceActivityEvents'

const liveDeps: PresenceActivityEventDeps = {
  setActivity: (userId, activity) => usePresenceActivityStore.getState().setActivity(userId, activity)
}

/** Liga o "em atividade" dos outros ao WS (presence:activity). Uma vez, na entrada do app. */
export function startPresenceActivity(): () => void {
  return onWsEvent((event) => handlePresenceActivityEvent(event, liveDeps))
}
