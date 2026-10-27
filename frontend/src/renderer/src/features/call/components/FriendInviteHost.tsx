import { useCallback, useState } from 'react'
import router from '../../../app/router'
import { showToast } from '../../../shared/store/toastStore'
import { useCallStore } from '../store/callStore'
import { useCallInviteStore } from '../store/callInviteStore'
import { acceptCallInvite, declineCallInvite, type ReceivedInvite } from '../api/callInvites'
import {
  acceptInviteAndJoin,
  InviteAcceptError,
  type AcceptInviteDeps
} from '../lib/acceptCallInvite'
import { INVITE_COPY } from '../lib/callInviteCopy'
import FriendInviteCard from './FriendInviteCard'

const liveAcceptDeps: AcceptInviteDeps = {
  inDmCall: () => {
    const s = useCallStore.getState()
    return s.status !== 'idle' && s.type !== 'channel'
  },
  accept: acceptCallInvite,
  resolved: (callId) => useCallInviteStore.getState().removeReceived(callId),
  // Não usa joinVoiceChannel: numa sala trancada ele bateria na porta em vez de
  // usar o passe que o convite deu.
  join: async (channelId) => {
    const s = useCallStore.getState()
    if (s.status !== 'idle') {
      if (s.channelId === channelId) return
      s.endCall()
    }
    await useCallStore.getState().startChannelCall(channelId)
  },
  navigate: (route) => void router.navigate(route)
}

/** Montado uma vez no App: os convites de call recebidos, com Aceitar e Recusar. */
function FriendInviteHost(): React.JSX.Element | null {
  const received = useCallInviteStore((s) => s.received)
  const currentCallId = useCallStore((s) => s.callId)
  const [busyId, setBusyId] = useState<string | null>(null)
  const remove = useCallback(
    (callId: string) => useCallInviteStore.getState().removeReceived(callId),
    []
  )

  const run = async (
    invite: ReceivedInvite,
    action: () => Promise<void>,
    failure: string
  ): Promise<void> => {
    setBusyId(invite.call_id)
    try {
      await action()
    } catch (err) {
      // Em chamada de DM o convite segue valendo (até expirar): só avisa.
      if (err instanceof InviteAcceptError) {
        showToast.error(err.message)
      } else {
        remove(invite.call_id)
        showToast.error(failure)
      }
    } finally {
      setBusyId(null)
    }
  }

  // Quem já entrou na call (por outro caminho) não precisa do cartão.
  const visible = received.filter((r) => r.call_id !== currentCallId)
  if (visible.length === 0) return null

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col gap-2 sm:left-auto sm:right-6 sm:w-full sm:max-w-sm">
      {visible.map((invite) => (
        <FriendInviteCard
          key={invite.call_id}
          invite={invite}
          busy={busyId === invite.call_id}
          onExpire={() => remove(invite.call_id)}
          onAccept={() =>
            void run(
              invite,
              () => acceptInviteAndJoin(invite, liveAcceptDeps),
              INVITE_COPY.acceptFailed
            )
          }
          onDecline={() =>
            void run(
              invite,
              async () => {
                await declineCallInvite(invite.call_id)
                remove(invite.call_id)
              },
              INVITE_COPY.declineFailed
            )
          }
        />
      ))}
    </div>
  )
}

export default FriendInviteHost
