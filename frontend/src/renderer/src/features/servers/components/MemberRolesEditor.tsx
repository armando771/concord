import { useState } from 'react'
import { roleColorCss, type Role } from '../lib/permissions'
import { canRemoveRole } from '../lib/memberSettings'

const DEFAULT_ROLE_COLOR = '#99aab5'

interface Props {
  /** Nome do membro (para os rótulos de acessibilidade). */
  name: string
  /** Cargos que o membro tem, do mais alto para o mais baixo. */
  own: Role[]
  memberRoleIds?: string[]
  /** Cargos que quem está vendo pode dar ou tirar. */
  assignable: Role[]
  /** Pode dar e tirar cargos deste membro. */
  editable: boolean
  onToggle: (roleId: string, has: boolean) => void
}

function RoleDot({ color }: { color: number | null }): React.JSX.Element {
  return (
    <span
      aria-hidden
      className="h-2.5 w-2.5 rounded-full"
      style={{ background: roleColorCss(color) ?? DEFAULT_ROLE_COLOR }}
    />
  )
}

/** Pílula de um cargo que o membro tem, com o × quando dá para tirar. */
function OwnRoleChip({
  role,
  name,
  removable,
  onRemove
}: {
  role: Role
  name: string
  removable: boolean
  onRemove: () => void
}): React.JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-normal bg-fg/5 py-0.5 pl-2 pr-1 text-xs text-gray-200">
      <RoleDot color={role.color} />
      {role.name}
      {removable ? (
        <button
          type="button"
          aria-label={`Tirar o cargo ${role.name} de ${name}`}
          onClick={onRemove}
          className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full text-gray-400 hover:bg-fg/15 hover:text-strong"
        >
          ×
        </button>
      ) : (
        <span className="w-1" />
      )}
    </span>
  )
}

/** O "+" e a lista de cargos para marcar/desmarcar. */
function RolePicker({
  name,
  memberRoleIds,
  assignable,
  onToggle
}: Pick<Props, 'name' | 'memberRoleIds' | 'assignable' | 'onToggle'>): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative">
      <button
        type="button"
        aria-label={`Dar um cargo a ${name}`}
        onClick={() => setOpen(!open)}
        className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-dashed border-strong text-sm text-gray-300 hover:border-strong hover:text-strong"
      >
        +
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <ul className="absolute left-0 top-full z-30 mt-1 max-h-56 w-52 overflow-y-auto rounded-xl border border-subtle bg-floating p-1.5 shadow-2xl">
            {assignable.map((role) => {
              const has = !!memberRoleIds?.includes(role.id)
              return (
                <li key={role.id}>
                  <button
                    type="button"
                    onClick={() => onToggle(role.id, has)}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-gray-200 hover:bg-fg/10"
                  >
                    <RoleDot color={role.color} />
                    <span className="min-w-0 flex-1 truncate">{role.name}</span>
                    {has && <span className="text-success">✓</span>}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </span>
  )
}

/** Cargos de um membro na aba Membros: as pílulas e o "+" para dar mais. */
function MemberRolesEditor({
  name,
  own,
  memberRoleIds,
  assignable,
  editable,
  onToggle
}: Props): React.JSX.Element {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-11">
      {own.map((role) => (
        <OwnRoleChip
          key={role.id}
          role={role}
          name={name}
          removable={canRemoveRole(editable, assignable, role.id)}
          onRemove={() => onToggle(role.id, true)}
        />
      ))}
      {editable && assignable.length > 0 && (
        <RolePicker
          name={name}
          memberRoleIds={memberRoleIds}
          assignable={assignable}
          onToggle={onToggle}
        />
      )}
    </div>
  )
}

export default MemberRolesEditor
