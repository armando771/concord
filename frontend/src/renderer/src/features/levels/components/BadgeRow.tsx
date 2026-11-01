import { useEffect, useState } from 'react'
import { useBadgeStore } from '../store/badgeStore'
import { badgeLabel, isMythic, profileBadgeRow, rarityMeta } from '../lib/badges'
import BadgeIcon from './BadgeIcon'
import { BadgeRowSkeleton } from '../../../shared/ui/skeleton/layouts'

interface BadgeRowProps {
  userId: string
  name: string
  avatarUrl?: string | null
  /** Antes de abrir o modal (o cartão de perfil fecha). */
  onOpen?: () => void
  max?: number
}

/**
 * Fileira de badges ao lado do username, como no Discord: os mais raros
 * primeiro, até `max` ícones e "+N". Passar o mouse mostra o tier e a
 * categoria; clicar abre o modal de badges.
 */
function BadgeRow({
  userId,
  name,
  avatarUrl,
  onOpen,
  max = 6
}: BadgeRowProps): React.JSX.Element | null {
  const badges = useBadgeStore((s) => s.byUser[userId]?.badges)
  const ensureBadges = useBadgeStore((s) => s.ensureBadges)
  const openModal = useBadgeStore((s) => s.openModal)

  // Quem já respondeu (mesmo com erro): o skeleton não fica para sempre se falhar.
  const [settled, setSettled] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void ensureBadges(userId).then(() => {
      if (!cancelled) setSettled(userId)
    })
    return () => {
      cancelled = true
    }
  }, [userId, ensureBadges])

  if (!badges) return settled === userId ? null : <BadgeRowSkeleton />
  const { shown, overflow } = profileBadgeRow(badges, max)
  if (shown.length === 0) return null

  const open = (category?: string): void => {
    onOpen?.()
    openModal({ userId, name, avatarUrl, category })
  }

  return (
    <div
      className="flex shrink-0 items-center gap-0.5 rounded-md border border-subtle bg-input px-1 py-0.5"
      aria-label="Badges"
    >
      {shown.map((b) => (
        <button
          key={b.category}
          type="button"
          onClick={() => open(b.category)}
          aria-label={badgeLabel(b)}
          className="group relative flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded transition-transform hover:scale-110"
        >
          <BadgeIcon category={b.category} tier={b.tier} rarity={b.rarity} size={20} />
          <span
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-subtle bg-floating px-2 py-1 text-center shadow-xl group-hover:block group-focus-visible:block"
          >
            {isMythic(b.rarity) ? (
              <span className="mythic-text block text-xs font-black">{b.tier_name}</span>
            ) : (
              <span
                className="block text-xs font-bold"
                style={{ color: rarityMeta(b.rarity).color }}
              >
                {b.tier_name}
              </span>
            )}
            {b.tier_name !== b.name && (
              <span className="block text-[10px] text-gray-400">{b.name}</span>
            )}
          </span>
        </button>
      ))}
      {overflow > 0 && (
        <button
          type="button"
          onClick={() => open()}
          aria-label={`Ver mais ${overflow} badges`}
          className="cursor-pointer rounded px-1 text-[11px] font-semibold text-gray-300 transition-colors hover:bg-fg/10 hover:text-strong"
        >
          +{overflow}
        </button>
      )}
    </div>
  )
}

export default BadgeRow
