import { useState } from 'react'
import { useServerStore } from '../../store/serverStore'
import { useServerAccess } from '../../store/useServerAccess'
import { useModerationStore } from '../../store/moderationStore'
import { showToast } from '../../store/toastStore'
import { actionErrorMessage } from '../../lib/permissionErrors'
import { Perm, roleColorCss, rolesOfMember } from '../../lib/permissions'
import { assignableRoles } from '../../lib/roleList'
import Avatar from '../Avatar'
import Button from '../Button'
import Input from '../Input'

/** Membros do servidor: cargos de cada um e expulsar/banir (respeitando a hierarquia). */
function MembersSection(): React.JSX.Element {
  const server = useServerStore((s) => s.currentServer)
  const members = useServerStore((s) => s.currentMembers)
  const roles = useServerStore((s) => s.roles)
  const addMemberRole = useServerStore((s) => s.addMemberRole)
  const removeMemberRole = useServerStore((s) => s.removeMemberRole)
  const askKick = useModerationStore((s) => s.askKick)
  const askBan = useModerationStore((s) => s.askBan)
  const access = useServerAccess()
  const [query, setQuery] = useState('')
  const [pickerFor, setPickerFor] = useState<string | null>(null)

  if (!server) return <p className="text-sm text-gray-400">Abra um servidor primeiro.</p>

  const assignable = assignableRoles(roles, {
    isOwner: access.isOwner,
    actorHighest: access.highest,
    canManageRoles: access.can(Perm.MANAGE_ROLES)
  })
  const nameOf = (m: (typeof members)[number]): string => m.display_name || m.username || 'Usuário'
  const term = query.trim().toLowerCase()
  const shown = members.filter(
    (m) =>
      !term ||
      nameOf(m).toLowerCase().includes(term) ||
      (m.username ?? '').toLowerCase().includes(term)
  )

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
      <p className="mb-2 text-ds-sm font-medium text-gray-400">
        Membros — {shown.length}
      </p>
      <ul className="divide-y divide-white/6 rounded-lg border border-white/8">
        {shown.map((m) => {
          const own = rolesOfMember(roles, m.role_ids)
          const isOwnerRow = m.user_id === server.owner_id
          const canAct = access.canActOnMember(m.user_id)
          // Dar/tirar cargo: MANAGE_ROLES e só cargos abaixo do seu (assignable).
          const canRoles = access.can(Perm.MANAGE_ROLES)
          return (
            <li key={m.user_id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar userId={m.user_id} name={nameOf(m)} avatarUrl={m.avatar_url} size={32} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-white">
                      {nameOf(m)}
                      {isOwnerRow && (
                        <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                          Dono
                        </span>
                      )}
                    </span>
                    {m.username && (
                      <span className="block text-xs text-gray-400">@{m.username}</span>
                    )}
                  </span>
                </span>
                <span className="flex shrink-0 gap-2">
                  {canAct && access.can(Perm.KICK_MEMBERS) && (
                    <Button
                      variant="ghost"
                      className="px-3 py-1 text-xs"
                      onClick={() =>
                        askKick({ serverId: server.id, userId: m.user_id, name: nameOf(m) })
                      }
                    >
                      Expulsar
                    </Button>
                  )}
                  {canAct && access.can(Perm.BAN_MEMBERS) && (
                    <Button
                      variant="danger"
                      className="px-3 py-1 text-xs"
                      onClick={() =>
                        askBan({ serverId: server.id, userId: m.user_id, name: nameOf(m) })
                      }
                    >
                      Banir
                    </Button>
                  )}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-11">
                {own.map((role) => {
                  const removable = canRoles && assignable.some((r) => r.id === role.id)
                  return (
                    <span
                      key={role.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 py-0.5 pl-2 pr-1 text-xs text-gray-200"
                    >
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: roleColorCss(role.color) ?? '#99aab5' }}
                      />
                      {role.name}
                      {removable ? (
                        <button
                          type="button"
                          aria-label={`Tirar o cargo ${role.name} de ${nameOf(m)}`}
                          onClick={() => void toggleRole(m.user_id, role.id, true)}
                          className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:bg-white/15 hover:text-white"
                        >
                          ×
                        </button>
                      ) : (
                        <span className="w-1" />
                      )}
                    </span>
                  )
                })}
                {canRoles && assignable.length > 0 && !isOwnerRow && (
                  <span className="relative">
                    <button
                      type="button"
                      aria-label={`Dar um cargo a ${nameOf(m)}`}
                      onClick={() => setPickerFor(pickerFor === m.user_id ? null : m.user_id)}
                      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-dashed border-white/25 text-sm text-gray-300 hover:border-white/50 hover:text-white"
                    >
                      +
                    </button>
                    {pickerFor === m.user_id && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setPickerFor(null)} />
                        <ul className="absolute left-0 top-full z-30 mt-1 max-h-56 w-52 overflow-y-auto rounded-xl border border-white/10 bg-[#0d0e15] p-1.5 shadow-2xl">
                          {assignable.map((role) => {
                            const has = !!m.role_ids?.includes(role.id)
                            return (
                              <li key={role.id}>
                                <button
                                  type="button"
                                  onClick={() => void toggleRole(m.user_id, role.id, has)}
                                  className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-gray-200 hover:bg-white/10"
                                >
                                  <span
                                    aria-hidden
                                    className="h-2.5 w-2.5 rounded-full"
                                    style={{ background: roleColorCss(role.color) ?? '#99aab5' }}
                                  />
                                  <span className="min-w-0 flex-1 truncate">{role.name}</span>
                                  {has && <span className="text-[#23a55a]">✓</span>}
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      </>
                    )}
                  </span>
                )}
              </div>
            </li>
          )
        })}
        {shown.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-gray-500">Ninguém encontrado.</li>
        )}
      </ul>
    </div>
  )
}

export default MembersSection
