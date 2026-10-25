import { useMemo } from 'react'
import { useLevelStore } from '../../store/levelStore'
import { isMilestone, levelTier, sparkCount } from '../../lib/levels'

/**
 * Animação de "subiu de nível" em volta do avatar na lista de membros: um
 * halo na cor da faixa gira em volta do avatar e faíscas saem dele. Nos
 * níveis redondos (10, 20…) ainda tem uma onda de choque. A cor e a
 * quantidade de faíscas mudam com a faixa, então cada fase tem a sua cara.
 * O pai precisa ser `relative` com o tamanho do avatar.
 */
function LevelUpBurst({ userId }: { userId: string }): React.JSX.Element | null {
  const celebration = useLevelStore((s) => s.celebrations[userId])

  const sparks = useMemo(() => {
    if (!celebration) return []
    const count = sparkCount(celebration.level)
    return Array.from({ length: count }, (_, i) => ({
      angle: (360 / count) * i + ((i * 37) % 13) - 6,
      dist: 22 + ((i * 53) % 14),
      delay: (i % 4) * 40,
      big: i % 3 === 0
    }))
  }, [celebration])

  if (!celebration) return null

  const tier = levelTier(celebration.level)
  const milestone = isMilestone(celebration.level)
  const halo = 46
  const vars = {
    '--level-color': tier.color,
    '--level-accent': tier.accent
  } as React.CSSProperties

  return (
    <span
      key={celebration.key}
      aria-live="polite"
      className="level-anim pointer-events-none absolute inset-0 z-10"
      style={vars}
    >
      <span className="sr-only">Subiu para o nível {celebration.level}</span>

      {milestone && (
        <span
          className="absolute left-1/2 top-1/2 rounded-full border-2"
          style={{
            width: halo,
            height: halo,
            borderColor: tier.color,
            animation: 'level-shockwave 1.1s ease-out 150ms both'
          }}
        />
      )}

      <span
        className="level-halo absolute left-1/2 top-1/2 rounded-full"
        style={{ width: halo, height: halo, animation: 'level-halo 1.8s ease-out both' }}
      />

      {sparks.map((spark, i) => (
        <span
          key={i}
          className="absolute left-1/2 top-1/2 rotate-45 rounded-[1px]"
          style={
            {
              '--angle': `${spark.angle}deg`,
              '--dist': `${spark.dist}px`,
              width: spark.big ? 5 : 3,
              height: spark.big ? 5 : 3,
              background: i % 2 === 0 ? tier.color : i % 3 === 0 ? '#ffffff' : tier.accent,
              boxShadow: `0 0 6px ${tier.color}`,
              animation: `level-spark 1s cubic-bezier(.15,.8,.3,1) ${200 + spark.delay}ms both`
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  )
}

export default LevelUpBurst
