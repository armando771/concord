import type { Badge } from '../api/badges'
import { formatThreshold, formatUnlockDate } from '../lib/badges'
import { LockIcon } from '../../../shared/ui/icons'
import BadgeIcon from './BadgeIcon'

/** A escada de tiers: arte, nome e limite de cada degrau. */
function BadgeTierLadder({ badge }: { badge: Badge }): React.JSX.Element {
  return (
    <ol className="mt-3 grid grid-cols-4 gap-x-2 gap-y-4">
      {badge.tiers.map((t) => {
        const done = Boolean(t.unlocked_at)
        return (
          <li
            key={t.tier}
            className="flex flex-col items-center text-center"
            title={done ? `Desbloqueado em ${formatUnlockDate(t.unlocked_at)}` : undefined}
          >
            <BadgeIcon
              category={badge.category}
              tier={t.tier}
              rarity={t.rarity}
              size={40}
              locked={!done}
            />
            <span
              className={`mt-1 text-xs font-semibold ${done ? 'text-gray-100' : 'text-gray-500'}`}
            >
              {t.name}
            </span>
            <span
              className={`flex items-center gap-0.5 text-[11px] ${done ? 'text-gray-400' : 'text-gray-500'}`}
            >
              {!done && <LockIcon className="h-2.5 w-2.5" />}
              {formatThreshold(badge.unit, t.threshold, badge.category)}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

export default BadgeTierLadder
