import type { Role } from '../../servers/lib/permissions'
import UserContextMenuModeration from './UserContextMenuModeration'
import { RoleAssignMenuItems } from './UserContextMenuSubmenus'

interface ServerSectionProps {
  server?: { id: string } | null
  member?: { user_id: string; role_ids?: string[]; nickname?: string | null; display_name?: string | null } | null
  canNick: boolean
  givable: Role[]
  voiceCallId?: string
  voiceState?: { server_muted?: boolean; server_deafened?: boolean }
  canMuteInVoice: boolean
  canDeafenInVoice: boolean
  canDisconnect: boolean
  canKick: boolean
  canBan: boolean
  target: { userId: string; name: string }
  saving: boolean
  close: () => void
  itemClass: string
  onEditNickname: () => void
  onToggleRole: (roleId: string, has: boolean) => void
  onModerate: (action: () => Promise<unknown>, fallback: string) => Promise<void>
}

export function StandardUserServerSection({
  server,
  member,
  canNick,
  givable,
  voiceCallId,
  voiceState,
  canMuteInVoice,
  canDeafenInVoice,
  canDisconnect,
  canKick,
  canBan,
  target,
  saving,
  close,
  itemClass,
  onEditNickname,
  onToggleRole,
  onModerate
}: ServerSectionProps): React.JSX.Element {
  return (
    <>
      {canNick && (
        <>
          <div className="my-1 h-px bg-fg/10" />
          <button role="menuitem" onClick={onEditNickname} className={itemClass}>
            Alterar apelido
          </button>
        </>
      )}

      {member && server && (
        <RoleAssignMenuItems
          givable={givable}
          memberRoleIds={member.role_ids}
          saving={saving}
          itemClass={itemClass}
          onToggleRole={onToggleRole}
        />
      )}

      <UserContextMenuModeration
        serverId={server?.id}
        voiceCallId={voiceCallId}
        targetUserId={target.userId}
        targetName={target.name}
        serverMuted={voiceState?.server_muted}
        serverDeafened={voiceState?.server_deafened}
        canMuteInVoice={canMuteInVoice}
        canDeafenInVoice={canDeafenInVoice}
        canDisconnect={canDisconnect}
        canKick={canKick}
        canBan={canBan}
        itemClass={itemClass}
        saving={saving}
        close={close}
        onModerate={onModerate}
      />
    </>
  )
}
