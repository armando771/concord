import { roleColorCss } from '../../servers/lib/permissions'
import type { Ink } from '../lib/profileTheme'
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
  /** Quando vem, o dono do servidor abre a lista. */
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
    <div className="flex flex-wrap gap-1.5">
      {owner && <Chip name={owner.label} color={owner.color} background={background} ink={ink} />}
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
