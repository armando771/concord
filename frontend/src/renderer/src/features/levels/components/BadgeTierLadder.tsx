import type { Badge } from '../api/badges'
import { formatUnlockDate } from '../lib/badges'
import BadgeIcon from './BadgeIcon'

/** Os tiers já conquistados: arte, nome e o dia. Os que faltam não aparecem. */
function BadgeTierLadder({ badge }: { badge: Badge }): React.JSX.Element {
  return (
    <ol className="mt-3 grid grid-cols-3 gap-x-2 gap-y-4 sm:grid-cols-4">
      {badge.tiers.map((t) => (
        <li key={t.tier} className="flex flex-col items-center text-center">
          <BadgeIcon category={badge.category} tier={t.tier} rarity={t.rarity} size={40} />
          <span className="mt-1 text-xs font-semibold text-gray-100">{t.name}</span>
          <span className="text-[11px] text-gray-400">{formatUnlockDate(t.unlocked_at)}</span>
        </li>
      ))}
    </ol>
  )
}

export default BadgeTierLadder
