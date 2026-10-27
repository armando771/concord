import { onWsEvent } from '../../../shared/api/ws'
import { useInviteValidityStore } from '../store/inviteValidityStore'
import { handleCallInviteEvent, type CallInviteEventDeps } from './callInviteEvents'

const liveDeps: CallInviteEventDeps = {
  invalid: (callId) => useInviteValidityStore.getState().markInvalid(callId)
}

/**
 * Liga os cartões de convite na DM ao fim da call (call:invite_ended do WS).
 * Chamado uma vez na entrada do app; devolve o "desligar".
 */
export function startCallInvites(): () => void {
  return onWsEvent((event) => handleCallInviteEvent(event, liveDeps))
}
