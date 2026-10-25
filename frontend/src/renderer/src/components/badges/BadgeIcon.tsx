import { badgeArt, type BadgeArtSize } from '../../lib/badgeArt'
import { rarityMeta } from '../../lib/badges'
import type { BadgeRarity } from '../../api/badges'
import { StarIcon } from '../icons'

interface BadgeIconProps {
  category: string
  tier: number
  /** Lado em px na tela. */
  size: number
  rarity?: BadgeRarity
  /** Ainda não conquistado: cinza e apagado. */
  locked?: boolean
  className?: string
}

/** A arte de um tier (ou uma estrela na cor da raridade, se faltar arte). */
function BadgeIcon({
  category,
  tier,
  size,
  rarity,
  locked = false,
  className = ''
}: BadgeIconProps): React.JSX.Element {
  const variant: BadgeArtSize = size > 64 ? 'lg' : 'sm'
  const src = badgeArt(category, tier, variant)
  const lockedClass = locked ? 'opacity-40 grayscale' : ''
  if (!src) {
    return (
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center ${lockedClass} ${className}`}
        style={{ width: size, height: size, color: rarityMeta(rarity).color }}
      >
        <StarIcon className="h-[80%] w-[80%]" />
      </span>
    )
  }
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      width={size}
      height={size}
      className={`select-none object-contain ${lockedClass} ${className}`}
      style={{ width: size, height: size }}
    />
  )
}

export default BadgeIcon
