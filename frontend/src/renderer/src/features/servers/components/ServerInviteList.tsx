import { useEffect } from 'react'
import { serverIconSrc } from '../lib/serverIcon'
import Button from '../../../shared/ui/Button'
import { InviteListSkeleton } from '../../../shared/ui/skeleton/layouts'
import { useInviteStore } from '../store/inviteStore'
import { useInviteActions } from '../hooks/useInviteActions'
import type { ServerInvite } from '../api/invites'
import { acceptLabel, inviteSubtitle, pendingInvitesLabel, serverInitial } from '../lib/inviteList'

function InviteIcon({ invite }: { invite: ServerInvite }): React.JSX.Element {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-violet-600 to-indigo-600 text-base font-bold text-white shadow-md">
      {invite.server_icon_url ? (
        <img
          src={serverIconSrc(invite.server_icon_url)}
          alt={invite.server_name ?? ''}
          className="h-full w-full object-cover"
        />
      ) : (
        serverInitial(invite.server_name)
      )}
    </div>
  )
}

function InviteRow({
  invite,
  busy,
  onAccept,
  onDecline
}: {
  invite: ServerInvite
  busy: boolean
  onAccept: (invite: ServerInvite) => void
  onDecline: (invite: ServerInvite) => void
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-subtle bg-fg/3 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <InviteIcon invite={invite} />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-strong">{invite.server_name}</p>
          <p className="truncate text-xs text-gray-400">{inviteSubtitle(invite)}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button variant="success" disabled={busy} onClick={() => onAccept(invite)}>
          {acceptLabel(busy)}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => onDecline(invite)}>
          Recusar
        </Button>
      </div>
    </div>
  )
}

function InviteListBody(): React.JSX.Element {
  const invites = useInviteStore((s) => s.invites)
  const loading = useInviteStore((s) => s.loading)
  const { actionId, accept, decline } = useInviteActions()

  if (loading) return <InviteListSkeleton />
  if (invites.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-gray-400">
        Nenhum convite pendente no momento. Quando alguém te convidar para um servidor, ele
        aparecerá aqui.
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2">
      {invites.map((invite) => (
        <InviteRow
          key={invite.id}
          invite={invite}
          busy={actionId === invite.id}
          onAccept={accept}
          onDecline={decline}
        />
      ))}
    </div>
  )
}

/** Convites de servidor pendentes, com Aceitar e Recusar (aba "Convites" do Início). */
export default function ServerInviteList(): React.JSX.Element {
  const count = useInviteStore((s) => s.invites.length)
  const loading = useInviteStore((s) => s.loading)
  const fetchInvites = useInviteStore((s) => s.fetchInvites)

  useEffect(() => {
    fetchInvites()
  }, [fetchInvites])

  return (
    <section>
      <h2 className="mb-2 mt-4 text-ds-sm font-medium text-gray-400">
        {pendingInvitesLabel(loading, count)}
      </h2>
      <InviteListBody />
    </section>
  )
}
