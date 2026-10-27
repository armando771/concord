import { onWsEvent } from '../../../shared/api/ws'
import { useAuthStore } from '../../auth/store/authStore'
import { notifyDesktop } from '../../notifications/lib/notifications'
import { useCallInviteStore } from '../store/callInviteStore'
import { handleCallInviteEvent, type CallInviteEventDeps } from './callInviteEvents'
import { inviteNotification } from './callInviteCopy'

const liveDeps: CallInviteEventDeps = {
  meId: () => useAuthStore.getState().user?.id,
  received: (invite) => useCallInviteStore.getState().addReceived(invite),
  receivedResolved: (callId) => useCallInviteStore.getState().removeReceived(callId),
  sentUpdated: (update) => useCallInviteStore.getState().markSent(update),
  notify: (invite) => notifyDesktop(inviteNotification(invite))
}

/**
 * Liga os convites de amigos para a call nos eventos do WS (call:friend_invite
 * e call:friend_invite_update). Chamado uma vez na entrada do app; devolve o
 * "desligar".
 */
export function startCallInvites(): () => void {
  return onWsEvent((event) => handleCallInviteEvent(event, liveDeps))
}
