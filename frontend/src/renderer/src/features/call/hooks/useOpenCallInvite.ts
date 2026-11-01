import { useCallback, useState } from 'react'
import router from '../../../app/router'
import { showToast } from '../../../shared/store/toastStore'
import { openCallInvite } from '../api/callInvites'
import { INVITE_COPY } from '../lib/callInviteCopy'
import {
  InviteOpenError,
  openInviteAndJoin,
  type OpenableInvite,
  type OpenInviteDeps
} from '../lib/openCallInvite'
import { useCallStore } from '../store/callStore'
import { useInviteValidityStore } from '../store/inviteValidityStore'

const liveDeps: OpenInviteDeps = {
  inDmCall: () => {
    const s = useCallStore.getState()
    return s.status !== 'idle' && s.type !== 'channel'
  },
  open: openCallInvite,
  invalid: (callId) => useInviteValidityStore.getState().markInvalid(callId, 'invitee'),
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

/** "Abrir" do cartão de convite: entra na call do canal (com aviso se não der). */
export function useOpenCallInvite(invite: OpenableInvite): { busy: boolean; open: () => void } {
  const [busy, setBusy] = useState(false)
  const open = useCallback(() => {
    setBusy(true)
    openInviteAndJoin(invite, liveDeps)
      .catch((err: unknown) => {
        showToast.error(err instanceof InviteOpenError ? err.message : INVITE_COPY.openFailed)
      })
      .finally(() => setBusy(false))
  }, [invite])
  return { busy, open }
}
