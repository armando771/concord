import { useLevelStore } from '../store/levelStore'
import { levelTier } from '../lib/levels'

/**
 * Brilho na cor da faixa que atravessa a linha do usuário na lista de membros
 * quando ele sobe de nível (o pai precisa ser relative).
 */
function LevelRowShimmer({ userId }: { userId: string }): React.JSX.Element | null {
  const celebration = useLevelStore((s) => s.celebrations[userId])
  if (!celebration) return null

  const tier = levelTier(celebration.level)
  return (
    <span
      key={celebration.key}
      aria-hidden="true"
      className="level-anim pointer-events-none absolute inset-0 overflow-hidden rounded-lg"
      style={{ background: `${tier.color}14` }}
    >
      <span
        className="absolute inset-y-0 w-1/2"
        style={{
          background: `linear-gradient(90deg, transparent, ${tier.color}55, transparent)`,
          animation: 'level-shimmer 1.2s ease-in-out 3 both'
        }}
      />
    </span>
  )
}

export default LevelRowShimmer
