import { useEffect } from 'react'
import Avatar from '../../../shared/ui/Avatar'
import type { ReceivedInvite } from '../api/callInvites'
import { INVITE_COPY } from '../lib/callInviteCopy'

/** Cartão do convite recebido: quem convidou, qual call, Aceitar e Recusar. */
function FriendInviteCard({
  invite,
  busy,
  onAccept,
  onDecline,
  onExpire
}: {
  invite: ReceivedInvite
  busy: boolean
  onAccept: () => void
  onDecline: () => void
  onExpire: () => void
}): React.JSX.Element {
  const name = invite.by.display_name || invite.by.username
  // O servidor avisa a expiração; isto só garante que o cartão não fica pendurado.
  useEffect(() => {
    const ms = Math.max(0, new Date(invite.expires_at).getTime() - Date.now())
    const t = setTimeout(onExpire, ms)
    return () => clearTimeout(t)
  }, [invite.expires_at, onExpire])

  return (
    <div
      role="group"
      aria-label={INVITE_COPY.cardTitle(name)}
      className="pointer-events-auto flex flex-col gap-3 rounded-xl border border-subtle bg-floating p-3 shadow-2xl backdrop-blur-md"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar userId={invite.by.id} name={name} avatarUrl={invite.by.avatar_url} size={40} />
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold text-strong">
            {INVITE_COPY.cardTitle(name)}
          </p>
          <p className="truncate text-xs text-gray-400">
            {INVITE_COPY.cardPlace(
              invite.channel_name || INVITE_COPY.fallbackChannel,
              invite.server_name ?? ''
            )}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onAccept}
          className="min-h-10 flex-1 cursor-pointer rounded-lg bg-success-strong px-3 text-sm font-medium text-white transition-colors hover:bg-success-strong-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-violet-400"
        >
          {INVITE_COPY.accept}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDecline}
          className="min-h-10 flex-1 cursor-pointer rounded-lg bg-fg/10 px-3 text-sm font-medium text-strong transition-colors hover:bg-fg/15 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-violet-400"
        >
          {INVITE_COPY.decline}
        </button>
      </div>
    </div>
  )
}

export default FriendInviteCard
