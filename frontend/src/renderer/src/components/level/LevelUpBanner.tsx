import { useAuthStore } from '../../store/authStore'
import { useLevelStore } from '../../store/levelStore'
import { isMilestone, levelTier } from '../../lib/levels'
import LevelBadge from './LevelBadge'

/**
 * Faixa no topo da janela quando VOCÊ sobe de nível: aparece mesmo que você
 * esteja num canal de texto e não esteja vendo o seu tile na chamada.
 */
function LevelUpBanner(): React.JSX.Element | null {
  const meId = useAuthStore((s) => s.user?.id)
  const celebration = useLevelStore((s) => (meId ? s.celebrations[meId] : undefined))

  if (!meId || !celebration) return null

  const tier = levelTier(celebration.level)
  const milestone = isMilestone(celebration.level)

  return (
    <div
      key={celebration.key}
      role="status"
      className="level-anim pointer-events-none fixed left-1/2 top-4 z-50 flex items-center gap-3 overflow-hidden rounded-2xl border bg-[#0b0b10]/90 px-4 py-2.5 shadow-2xl backdrop-blur-xl"
      style={{
        borderColor: `${tier.color}66`,
        boxShadow: `0 0 28px ${tier.color}55`,
        animation: 'level-banner 3.2s ease-in-out both'
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 w-1/3"
        style={{
          background: `linear-gradient(90deg, transparent, ${tier.color}33, transparent)`,
          animation: 'level-shimmer 1.4s ease-in-out 300ms 2 both'
        }}
      />
      <span className="text-xl" aria-hidden="true">
        {milestone ? '🏆' : '⬆️'}
      </span>
      <div className="relative leading-tight">
        <p className="text-sm font-bold text-white">
          {milestone ? 'Marco alcançado!' : 'Você subiu de nível!'}
        </p>
        <p className="text-[11px] text-gray-400">Faixa {tier.name}</p>
      </div>
      <LevelBadge userId={meId} size="md" className="relative" />
    </div>
  )
}

export default LevelUpBanner
