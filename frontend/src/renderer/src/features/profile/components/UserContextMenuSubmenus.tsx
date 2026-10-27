import { roleColorCss, type Role } from '../../servers/lib/permissions'

interface RoleAssignMenuItemsProps {
  givable: Role[]
  memberRoleIds?: string[]
  saving: boolean
  itemClass: string
  onToggleRole: (roleId: string, has: boolean) => void
}

export function RoleAssignMenuItems({
  givable,
  memberRoleIds,
  saving,
  itemClass,
  onToggleRole
}: RoleAssignMenuItemsProps): React.JSX.Element | null {
  if (givable.length === 0) return null

  return (
    <>
      <div className="my-1 h-px bg-fg/10" />
      <p className="px-2 pt-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
        Cargos
      </p>
      <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
        {givable.map((role) => {
          const has = !!memberRoleIds?.includes(role.id)
          return (
            <button
              key={role.id}
              role="menuitemcheckbox"
              aria-checked={has}
              disabled={saving}
              onClick={() => onToggleRole(role.id, has)}
              className={`${itemClass} flex items-center gap-2`}
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: roleColorCss(role.color) ?? '#99aab5' }}
              />
              <span className="min-w-0 flex-1 truncate">{role.name}</span>
              {has && <span className="text-success">✓</span>}
            </button>
          )
        })}
      </div>
    </>
  )
}

export function UserVoiceMoveSection({
  moveTargets,
  saving,
  itemClass,
  onMoveTo
}: {
  moveTargets: Array<{ id: string; name: string }>
  saving: boolean
  itemClass: string
  onMoveTo: (channelId: string, channelName: string) => void
}): React.JSX.Element | null {
  if (moveTargets.length === 0) return null
  return (
    <>
      <div className="my-1 h-px bg-fg/10" />
      <p className="px-2 pt-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">
        Mover para
      </p>
      <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
        {moveTargets.map((ch) => (
          <button
            key={ch.id}
            role="menuitem"
            disabled={saving}
            onClick={() => onMoveTo(ch.id, ch.name)}
            className={`${itemClass} truncate`}
          >
            🔊 {ch.name}
          </button>
        ))}
      </div>
    </>
  )
}
