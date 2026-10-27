import type { InviteUpdate, ReceivedInvite } from '../api/callInvites'

/** O que o tratamento dos eventos lê e escreve (injetado: o teste não sobe os stores). */
export interface CallInviteEventDeps {
  meId: () => string | undefined
  received: (invite: ReceivedInvite) => void
  /** O convite que eu recebi foi resolvido (aceito, recusado, expirou, cancelou). */
  receivedResolved: (callId: string) => void
  /** Convite que eu enviei mudou de estado. */
  sentUpdated: (update: InviteUpdate) => void
  notify: (invite: ReceivedInvite) => void
}

/** call:friend_invite e call:friend_invite_update do WebSocket. */
export function handleCallInviteEvent(
  event: { type: string; payload: unknown },
  deps: CallInviteEventDeps
): void {
  if (event.type === 'call:friend_invite') {
    const invite = event.payload as ReceivedInvite | null
    if (!invite?.call_id || !invite.by?.id) return
    deps.received(invite)
    deps.notify(invite)
    return
  }
  if (event.type !== 'call:friend_invite_update') return
  const update = event.payload as InviteUpdate | null
  if (!update?.call_id || !update.user_id) return
  if (update.user_id === deps.meId()) deps.receivedResolved(update.call_id)
  else deps.sentUpdated(update)
}
