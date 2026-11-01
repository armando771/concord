import { useServerAccess } from '../../servers/hooks/useServerAccess'
import { Perm } from '../../servers/lib/permissions'
import GuestInviteButton from './GuestInviteButton'

/** O botão "Convidar visitante" na call, só para quem tem a permissão no canal. */
function GuestInviteEntry({ channelId }: { channelId: string }): React.JSX.Element | null {
  const access = useServerAccess()
  if ((access.channelPerms(channelId) & Perm.INVITE_GUESTS) === 0) return null
  return <GuestInviteButton channelId={channelId} />
}

export default GuestInviteEntry
