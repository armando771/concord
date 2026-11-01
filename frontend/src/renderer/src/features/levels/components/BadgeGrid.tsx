import type { Badge } from '../api/badges'
import BadgeIcon from './BadgeIcon'

function Tile({
  badge,
  selected,
  onSelect
}: {
  badge: Badge
  selected: boolean
  onSelect: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={`${badge.tier_name} · ${badge.name}`}
      className={`flex aspect-square cursor-pointer items-center justify-center rounded-xl border transition-colors ${
        selected ? 'border-brand bg-brand/15' : 'border-transparent bg-fg/5 hover:bg-fg/10'
      }`}
    >
      <BadgeIcon category={badge.category} tier={badge.tier} rarity={badge.rarity} size={34} />
    </button>
  )
}

/** Grade de badges (4 por linha); o selecionado fica marcado. */
function BadgeGrid({
  badges,
  selected,
  onSelect
}: {
  badges: Badge[]
  selected: string | undefined
  onSelect: (category: string) => void
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-4 gap-2">
      {badges.map((b) => (
        <Tile
          key={b.category}
          badge={b}
          selected={selected === b.category}
          onSelect={() => onSelect(b.category)}
        />
      ))}
    </div>
  )
}

export default BadgeGrid
