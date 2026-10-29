import { onWsEvent } from '../../../shared/api/ws'
import { usePresenceActivityStore } from '../store/presenceActivityStore'
import { useListeningStore } from '../store/listeningStore'
import {
  handlePresenceActivityEvent,
  type PresenceActivityEventDeps
} from './presenceActivityEvents'

const liveDeps: PresenceActivityEventDeps = {
  setActivity: (userId, activity) =>
    usePresenceActivityStore.getState().setActivity(userId, activity),
  setListening: (userId, listening) => useListeningStore.getState().setListening(userId, listening)
}

/** Liga o "em atividade" (jogo e música) dos outros ao WS. Uma vez, na entrada do app. */
export function startPresenceActivity(): () => void {
  return onWsEvent((event) => handlePresenceActivityEvent(event, liveDeps))
}
