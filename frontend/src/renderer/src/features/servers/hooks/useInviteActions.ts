import { useState } from 'react'
import { useInviteStore } from '../store/inviteStore'
import { useServerStore } from '../store/serverStore'
import { showToast } from '../../../shared/store/toastStore'
import { errorMessage } from '../../../shared/lib/errorMessage'
import type { ServerInvite } from '../api/invites'

/** Aceitar / recusar um convite de servidor, marcando qual está em andamento. */
export function useInviteActions(): {
  actionId: string | null
  accept: (invite: ServerInvite) => Promise<void>
  decline: (invite: ServerInvite) => Promise<void>
} {
  const acceptInvite = useInviteStore((s) => s.accept)
  const declineInvite = useInviteStore((s) => s.decline)
  const fetchServers = useServerStore((s) => s.fetchServers)
  const [actionId, setActionId] = useState<string | null>(null)

  const run = async (id: string, task: () => Promise<void>, fallback: string): Promise<void> => {
    setActionId(id)
    try {
      await task()
    } catch (err) {
      showToast.error(errorMessage(err, fallback))
    } finally {
      setActionId(null)
    }
  }

  return {
    actionId,
    accept: (invite) =>
      run(
        invite.id,
        async () => {
          await acceptInvite(invite.id)
          await fetchServers()
          showToast.success(`Você entrou no servidor ${invite.server_name ?? ''}!`)
        },
        'Falha ao aceitar o convite.'
      ),
    decline: (invite) =>
      run(
        invite.id,
        async () => {
          await declineInvite(invite.id)
          showToast.info('Convite recusado.')
        },
        'Falha ao recusar o convite.'
      )
  }
}
