import ContextSubmenu from '../../../shared/ui/ContextSubmenu'
import { VolumeIcon } from '../../../shared/ui/icons'
import { roleColorCss, type Role } from '../../servers/lib/permissions'

/** Itens dos submenus: mais altos no toque, para o dedo acertar (40 px). */
const submenuItem = (itemClass: string): string =>
  `${itemClass} flex items-center gap-2 py-2.5 sm:py-1.5 pointer-coarse:py-2.5`

interface RoleItemsProps {
  givable: Role[]
  memberRoleIds?: string[]
  saving: boolean
  itemClass: string
  onToggleRole: (roleId: string, has: boolean) => void
}

/** Cargos atribuíveis: bolinha de cor, nome e caixa marcada se a pessoa tem o cargo. */
export function RoleSubmenuItems({
  givable,
  memberRoleIds,
  saving,
  itemClass,
  onToggleRole
}: RoleItemsProps): React.JSX.Element {
  return (
    <>
      {givable.map((role) => {
        const has = !!memberRoleIds?.includes(role.id)
        return (
          <button
            key={role.id}
            type="button"
            role="menuitemcheckbox"
            aria-checked={has}
            aria-disabled={saving}
            onClick={saving ? undefined : () => onToggleRole(role.id, has)}
            className={`${submenuItem(itemClass)} ${saving ? 'opacity-50' : ''}`}
          >
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: roleColorCss(role.color) ?? '#99aab5' }}
            />
            <span className="min-w-0 flex-1 truncate">{role.name}</span>
            <span
              aria-hidden
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[11px] font-black leading-none ${
                has ? 'border-brand bg-brand text-white' : 'border-gray-500'
              }`}
            >
              {has && '✓'}
            </span>
          </button>
        )
      })}
    </>
  )
}

interface MoveItemsProps {
  moveTargets: Array<{ id: string; name: string }>
  saving: boolean
  itemClass: string
  onMoveTo: (channelId: string, channelName: string) => void
}

/** Canais de voz para onde mover a pessoa. */
export function VoiceMoveSubmenuItems({
  moveTargets,
  saving,
  itemClass,
  onMoveTo
}: MoveItemsProps): React.JSX.Element {
  return (
    <>
      {moveTargets.map((ch) => (
        <button
          key={ch.id}
          type="button"
          role="menuitem"
          disabled={saving}
          onClick={() => onMoveTo(ch.id, ch.name)}
          className={submenuItem(itemClass)}
        >
          <VolumeIcon className="h-4 w-4 shrink-0 text-gray-400" />
          <span className="min-w-0 flex-1 truncate">{ch.name}</span>
        </button>
      ))}
    </>
  )
}

interface MemberSubmenusProps extends RoleItemsProps, MoveItemsProps {}

/**
 * "Cargos ›" e "Mover para ›": itens compactos que abrem submenus ao lado.
 * Cada um só aparece se há o que mostrar (as permissões já filtram a lista).
 */
export function UserMemberSubmenus({
  givable,
  memberRoleIds,
  moveTargets,
  saving,
  itemClass,
  onToggleRole,
  onMoveTo
}: MemberSubmenusProps): React.JSX.Element | null {
  const hasRoles = givable.length > 0
  const hasMove = moveTargets.length > 0
  if (!hasRoles && !hasMove) return null
  return (
    <>
      <div className="my-1 h-px bg-fg/10" />
      {hasRoles && (
        <ContextSubmenu label="Cargos" triggerClass={itemClass}>
          <RoleSubmenuItems
            givable={givable}
            memberRoleIds={memberRoleIds}
            saving={saving}
            itemClass={itemClass}
            onToggleRole={onToggleRole}
          />
        </ContextSubmenu>
      )}
      {hasMove && (
        <ContextSubmenu label="Mover para" triggerClass={itemClass}>
          <VoiceMoveSubmenuItems
            moveTargets={moveTargets}
            saving={saving}
            itemClass={itemClass}
            onMoveTo={onMoveTo}
          />
        </ContextSubmenu>
      )}
    </>
  )
}
