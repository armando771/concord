import { useAuthStore } from '../../auth/store/authStore'
import { usePresenceStatus } from '../store/chatStore'
import { useUserLook } from '../../profile/store/profileStore'
import { profileCardHandler } from '../../profile/store/profileCardStore'
import { userMenuHandler } from '../../profile/store/userMenuStore'
import Avatar from '../../../shared/ui/Avatar'
import StyledName from '../../profile/components/StyledName'
import { XIcon } from '../../../shared/ui/icons'
import type { ConversationOtherUser } from '../api/conversations'

/** Um participante na lista do grupo; o dono pode removê-lo. */
function GroupMemberRow({
  member,
  isOwner,
  canRemove,
  onRemove
}: {
  member: ConversationOtherUser
  isOwner: boolean
  canRemove: boolean
  onRemove: () => void
}): React.JSX.Element {
  const meId = useAuthStore((s) => s.user?.id)
  const status = usePresenceStatus(member.id)
  const look = useUserLook(member.id, {
    name: member.display_name || member.username,
    avatarUrl: member.avatar_url
  })
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={profileCardHandler(member.id, look.name, member.username, 'left')}
      onContextMenu={userMenuHandler(member.id, look.name, meId, member.username)}
      className="group flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-fg/6"
    >
      <Avatar
        userId={member.id}
        name={look.name}
        avatarUrl={look.avatarUrl}
        size={32}
        status={status}
        cutoutColor="var(--bg-secondary)"
      />
      <span
        className={`min-w-0 flex-1 truncate text-ds-md font-medium ${
          status === 'offline' ? 'text-gray-500' : 'text-gray-200'
        }`}
      >
        <StyledName name={look.name} userId={member.id} style={member.name_style} />
      </span>
      {isOwner && (
        <span title="Dono do grupo" className="text-warning">
          👑
        </span>
      )}
      {canRemove && (
        <button
          type="button"
          title="Remover do grupo"
          aria-label="Remover do grupo"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="hidden cursor-pointer text-gray-400 hover:text-danger group-hover:block"
        >
          <XIcon className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export default GroupMemberRow
