import { useNavigate } from 'react-router-dom'
import { ChatBubbleIcon, CheckIcon, DotsIcon, XIcon } from '../../../shared/ui/icons'
import type { PublicUser } from '../../auth/store/authStore'
import { useFriendStore } from '../store/friendStore'
import { usePresenceStatus } from '../../chat/store/chatStore'
import { useUserMenuStore } from '../../profile/store/userMenuStore'
import { STATUS_META } from '../lib/presenceStatus'
import { showToast } from '../../../shared/store/toastStore'
import { errorMessage } from '../../../shared/lib/errorMessage'
import { ActivityLine } from '../../activity/components/ActivityLine'
import type { PendingRequest } from '../api/friends'
import { pendingCopy } from '../lib/pendingCopy'
import { PersonRow, RowAction } from './PersonRow'
import { usePendingActions } from '../hooks/usePendingActions'

function openUserMenu(friend: PublicUser, x: number, y: number): void {
  useUserMenuStore.getState().open({
    userId: friend.id,
    name: friend.display_name || friend.username,
    username: friend.username,
    x,
    y
  })
}

export function FriendRow({ friend }: { friend: PublicUser }): React.JSX.Element {
  const navigate = useNavigate()
  const status = usePresenceStatus(friend.id)
  const note = friend.status_text?.trim()
  const openDm = (): void => void navigate(`/dm/${friend.id}`)
  return (
    <PersonRow
      user={friend}
      showStatus
      subtitle={
        <ActivityLine
          userId={friend.id}
          note={status !== 'offline' ? note : null}
          statusLabel={STATUS_META[status].label}
        />
      }
      onClick={openDm}
      onContextMenu={(e) => {
        e.preventDefault()
        openUserMenu(friend, e.clientX, e.clientY)
      }}
    >
      <RowAction label="Enviar mensagem" onClick={openDm}>
        <ChatBubbleIcon className="h-[18px] w-[18px]" />
      </RowAction>
      <RowAction
        label="Mais"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          openUserMenu(friend, r.left, r.bottom + 4)
        }}
      >
        <DotsIcon className="h-[18px] w-[18px]" />
      </RowAction>
    </PersonRow>
  )
}

export function PendingRow({ request }: { request: PendingRequest }): React.JSX.Element {
  const { incoming, accept, deny } = usePendingActions(request)
  const user = { ...request, id: request.user_id }
  const copy = pendingCopy(incoming)
  return (
    <PersonRow user={user} showStatus={false} subtitle={copy.subtitle}>
      {incoming && (
        <RowAction label="Aceitar" tone="accept" onClick={accept}>
          <CheckIcon className="h-5 w-5" />
        </RowAction>
      )}
      <RowAction label={copy.denyLabel} tone="deny" onClick={deny}>
        <XIcon className="h-4 w-4" />
      </RowAction>
    </PersonRow>
  )
}

export function BlockedRow({ user }: { user: PublicUser }): React.JSX.Element {
  const unblock = useFriendStore((s) => s.unblock)
  return (
    <PersonRow user={user} showStatus={false} subtitle="Bloqueado">
      <button
        type="button"
        onClick={() =>
          unblock(user.id).catch((err) =>
            showToast.error(errorMessage(err, 'Falha ao desbloquear.'))
          )
        }
        className="cursor-pointer rounded-md bg-floating px-3 py-1.5 text-ds-sm font-medium text-gray-300 transition-colors hover:bg-fg/10 hover:text-strong"
      >
        Desbloquear
      </button>
    </PersonRow>
  )
}
