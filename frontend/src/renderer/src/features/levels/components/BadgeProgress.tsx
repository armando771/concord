import type { Badge } from '../api/badges'
import { progressPercent, remainingText } from '../lib/badges'
import BadgeIcon from './BadgeIcon'

/** "Seu progresso": quanto falta e a barra até o próximo tier (só no próprio perfil). */
function BadgeProgress({ badge, mythic }: { badge: Badge; mythic: boolean }): React.JSX.Element {
  const earned = badge.tier > 0
  const maxed = badge.tier >= badge.tiers.length

  return (
    <>
      <p className="text-sm font-semibold text-strong">Seu progresso</p>
      <div className="mt-3 flex items-center gap-3">
        {earned && (
          <BadgeIcon category={badge.category} tier={badge.tier} rarity={badge.rarity} size={32} />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-100">{remainingText(badge)}</p>
          <div
            className="mt-1.5 h-2 overflow-hidden rounded-full bg-fg/10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progressPercent(badge)}
            aria-label={`Progresso para ${badge.next_tier_name ?? 'o próximo tier'}`}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${
                mythic ? 'mythic-bar' : 'bg-brand'
              }`}
              style={{ width: `${progressPercent(badge)}%` }}
            />
          </div>
        </div>
        {!maxed && (
          <BadgeIcon
            category={badge.category}
            tier={badge.tier + 1}
            rarity={badge.tiers[badge.tier]?.rarity}
            size={32}
            locked
          />
        )}
      </div>
      <div className="my-4 h-px bg-fg/10" />
    </>
  )
}

export default BadgeProgress
