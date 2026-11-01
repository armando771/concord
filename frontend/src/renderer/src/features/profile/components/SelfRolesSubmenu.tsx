import { useServerAccess } from '../../servers/hooks/useServerAccess'
import { useServerStore } from '../../servers/store/serverStore'
import { useStandardUserMenuActions } from '../hooks/useStandardUserMenuActions'
import { computeSelfGivableRoles } from '../lib/userMenuActions'
import { UserMemberSubmenus } from './UserContextMenuSubmenus'

const NO_MOVE: Array<{ id: string; name: string }> = []

/** "Cargos ›" no menu de si mesmo; só aparece para o dono do servidor. */
export default function SelfRolesSubmenu({
  target,
  itemClass,
  close
}: {
  target: { userId: string; name: string }
  itemClass: string
  close: () => void
}): React.JSX.Element | null {
  const server = useServerStore((s) => s.currentServer)
  const member = useServerStore((s) => s.currentMembers.find((m) => m.user_id === target.userId))
  const roles = useServerStore((s) => s.roles)
  const access = useServerAccess()
  const { saving, toggleRole } = useStandardUserMenuActions(target, server?.id, close)
  const givable = computeSelfGivableRoles(Boolean(server && member), roles, access)

  return (
    <UserMemberSubmenus
      givable={givable}
      memberRoleIds={member?.role_ids}
      moveTargets={NO_MOVE}
      saving={saving}
      itemClass={itemClass}
      onToggleRole={(roleId, has) => void toggleRole(roleId, has)}
      onMoveTo={() => undefined}
    />
  )
}
