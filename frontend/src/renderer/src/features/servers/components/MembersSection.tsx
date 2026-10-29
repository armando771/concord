import { useState } from 'react'
import { useServerStore } from '../store/serverStore'
import { useServerAccess } from '../hooks/useServerAccess'
import { showToast } from '../../../shared/store/toastStore'
import { actionErrorMessage } from '../lib/permissionErrors'
import { Perm, rolesOfMember } from '../lib/permissions'
import { assignableRoles } from '../lib/roleList'
import { memberRowAccess } from '../lib/memberSettings'
import { serverDisplayName } from '../lib/serverNames'
import { useAuthStore } from '../../auth/store/authStore'
import type { ServerMember } from '../api/servers'
import Input from '../../../shared/ui/Input'
import MemberSettingsRow from './MemberSettingsRow'

// Nome no servidor (apelido, senão o de exibição); a busca acha pelos três.
const nameOf = (m: ServerMember): string => serverDisplayName(m, m)

const matches = (m: ServerMember, term: string): boolean =>
  !term || [m.nickname, m.display_name, m.username].some((v) => v?.toLowerCase().includes(term))

/** Membros do servidor: cargos de cada um e expulsar/banir (respeitando a hierarquia). */
function MembersSection(): React.JSX.Element {
  const server = useServerStore((s) => s.currentServer)
  const members = useServerStore((s) => s.currentMembers)
  const roles = useServerStore((s) => s.roles)
  const addMemberRole = useServerStore((s) => s.addMemberRole)
  const removeMemberRole = useServerStore((s) => s.removeMemberRole)
  const meId = useAuthStore((s) => s.user?.id)
  const access = useServerAccess()
  const [query, setQuery] = useState('')

  if (!server) return <p className="text-sm text-gray-400">Abra um servidor primeiro.</p>

  const assignable = assignableRoles(roles, {
    isOwner: access.isOwner,
    actorHighest: access.highest,
    canManageRoles: access.can(Perm.MANAGE_ROLES)
  })
  const term = query.trim().toLowerCase()
  const shown = members.filter((m) => matches(m, term))

  const toggleRole = async (userId: string, roleId: string, has: boolean): Promise<void> => {
    try {
      if (has) await removeMemberRole(server.id, userId, roleId)
      else await addMemberRole(server.id, userId, roleId)
    } catch (err) {
      showToast.error(actionErrorMessage(err, 'Não foi possível mudar o cargo.'))
    }
  }

  return (
    <div>
      <Input
        placeholder="Buscar membros"
        aria-label="Buscar membros"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4"
      />
      <p className="mb-2 text-ds-sm font-medium text-gray-400">Membros — {shown.length}</p>
      <ul className="divide-y divide-subtle rounded-lg border border-subtle">
        {shown.map((m) => (
          <MemberSettingsRow
            key={m.user_id}
            serverId={server.id}
            member={m}
            name={nameOf(m)}
            isOwner={m.user_id === server.owner_id}
            isMe={m.user_id === meId}
            access={memberRowAccess(access, m.user_id)}
            own={rolesOfMember(roles, m.role_ids)}
            assignable={assignable}
            onToggleRole={(roleId, has) => void toggleRole(m.user_id, roleId, has)}
          />
        ))}
        {shown.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-gray-500">Ninguém encontrado.</li>
        )}
      </ul>
    </div>
  )
}

export default MembersSection
