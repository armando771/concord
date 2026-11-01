import { roleColorCss } from '../../servers/lib/permissions'
import OwnerCrown from '../../servers/components/OwnerCrown'
import type { Ink } from '../lib/profileInk'
import { readableColor } from '../lib/readableColor'

/** Cor de cargo sem cor definida. */
const DEFAULT_ROLE_COLOR = '#99aab5'

interface Look {
  /** Cores do fundo do perfil; vazio é perfil sem tema. */
  background: string[]
  ink: Ink
}

interface Props extends Look {
  roles: { id: string; name: string; color: number | null }[]
  /**
   * Quando vem, a pessoa é o dono do servidor: a coroa abre a lista. O dono não
   * é um cargo; sem cargo nenhum, a coroa vem com "Sem cargo".
   */
  owner?: { label: string; color: string }
}

function Chip({
  name,
  color,
  background,
  ink
}: Look & { name: string; color: string }): React.JSX.Element {
  const text = readableColor(color, background, ink)
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md bg-fg/5 px-2 py-0.5 text-xs font-semibold"
      style={{ color: text }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: text }} />
      {name}
    </span>
  )
}

/** Cargos do membro, com a cor legível no fundo do perfil. */
export default function ProfileRoleChips({
  roles,
  owner,
  background,
  ink
}: Props): React.JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {owner && <OwnerCrown className="h-4 w-4" />}
      {owner && roles.length === 0 && (
        <span className="text-xs" style={{ color: readableColor('#9ca3af', background, ink) }}>
          Sem cargo
        </span>
      )}
      {roles.map((r) => (
        <Chip
          key={r.id}
          name={r.name}
          color={roleColorCss(r.color) ?? DEFAULT_ROLE_COLOR}
          background={background}
          ink={ink}
        />
      ))}
    </div>
  )
}

/** "Faixa Prata", na cor da faixa quando ela lê no fundo do perfil. */
export function TierName({
  name,
  color,
  background,
  ink
}: Look & { name: string; color: string }): React.JSX.Element {
  return <span style={{ color: readableColor(color, background, ink) }}>Faixa {name}</span>
}
