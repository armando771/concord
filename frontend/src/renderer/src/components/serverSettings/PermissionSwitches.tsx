import { PERMISSION_GROUPS, Perm, type PermissionGroup } from '../../lib/permissions'
import Switch from '../Switch'

interface PermissionSwitchesProps {
  /** Permissões ligadas (bits). */
  value: number
  onChange: (next: number) => void
  /** Pode ligar/desligar esse bit? Quem não tem uma permissão não a dá a outros. */
  canToggle: (bit: number) => boolean
  groups?: PermissionGroup[]
}

/** Um interruptor por permissão, agrupados (Geral, Membros, Texto, Voz). */
function PermissionSwitches({
  value,
  onChange,
  canToggle,
  groups = PERMISSION_GROUPS
}: PermissionSwitchesProps): React.JSX.Element {
  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <section key={group.title}>
          <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-gray-400">
            {group.title}
          </h3>
          <ul className="divide-y divide-white/6 rounded-lg border border-white/8 bg-white/3">
            {group.permissions.map((p) => {
              const bit = Perm[p.name]
              const allowed = canToggle(bit)
              return (
                <li
                  key={p.name}
                  className={`flex items-center justify-between gap-4 px-4 py-3 ${
                    allowed ? '' : 'opacity-50'
                  }`}
                  title={allowed ? undefined : 'Você não tem essa permissão para dar a outros.'}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{p.label}</p>
                    <p className="text-xs leading-snug text-gray-400">{p.description}</p>
                  </div>
                  <div className={allowed ? '' : 'pointer-events-none'}>
                    <Switch
                      checked={(value & bit) !== 0}
                      label={p.label}
                      onChange={(on) => onChange(on ? value | bit : value & ~bit)}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}

export default PermissionSwitches
