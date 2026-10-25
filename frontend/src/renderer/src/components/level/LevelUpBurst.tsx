import { useMemo } from 'react'
import { useLevelStore } from '../../store/levelStore'
import { isMilestone, levelTier, sparkCount } from '../../lib/levels'

interface LevelUpBurstProps {
  userId: string
  /** Tamanho do avatar no centro (o halo e as faíscas se ajustam). */
  size?: 'lg' | 'md'
}

/**
 * Animação de "subiu de nível" por cima do tile do participante:
 * o tile brilha na cor da faixa, um halo gira em volta do avatar, faíscas
 * explodem para fora e "NÍVEL N" sobe e some. Nos níveis redondos (10, 20…)
 * ainda tem uma onda de choque e mais faíscas. A cor e a quantidade de
 * faíscas mudam com a faixa, então cada fase de níveis tem a sua cara.
 */
function LevelUpBurst({ userId, size = 'lg' }: LevelUpBurstProps): React.JSX.Element | null {
  const celebration = useLevelStore((s) => s.celebrations[userId])

  const sparks = useMemo(() => {
    if (!celebration) return []
    const count = sparkCount(celebration.level)
    const base = size === 'lg' ? 80 : 52
    return Array.from({ length: count }, (_, i) => ({
      angle: (360 / count) * i + ((i * 37) % 13) - 6,
      dist: base + ((i * 53) % 34),
      delay: (i % 4) * 40,
      big: i % 3 === 0
    }))
  }, [celebration, size])

  if (!celebration) return null

  const tier = levelTier(celebration.level)
  const milestone = isMilestone(celebration.level)
  const halo = size === 'lg' ? 132 : 84
  const vars = {
    '--level-color': tier.color,
    '--level-accent': tier.accent
  } as React.CSSProperties

  return (
    <div
      key={celebration.key}
      aria-live="polite"
      className="level-anim pointer-events-none absolute inset-0 z-10 rounded-2xl"
      style={{ ...vars, animation: 'level-tile-glow 2.4s ease-out both' }}
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
          className="absolute left-1/2 top-1/2 rotate-45 rounded-[2px]"
          style={
            {
              '--angle': `${spark.angle}deg`,
              '--dist': `${spark.dist}px`,
              width: spark.big ? 7 : 4,
              height: spark.big ? 7 : 4,
              background: i % 2 === 0 ? tier.color : i % 3 === 0 ? '#ffffff' : tier.accent,
              boxShadow: `0 0 8px ${tier.color}`,
              animation: `level-spark 1.1s cubic-bezier(.15,.8,.3,1) ${200 + spark.delay}ms both`
            } as React.CSSProperties
          }
        />
      ))}

      <span
        className={`absolute left-1/2 whitespace-nowrap font-black uppercase tracking-widest ${
          size === 'lg' ? 'top-[14%] text-lg' : 'top-[8%] text-xs'
        }`}
        style={{
          color: tier.color,
          textShadow: `0 0 12px ${tier.color}, 0 2px 0 rgba(0,0,0,.6)`,
          animation: 'level-float 2.6s ease-out 250ms both'
        }}
      >
        {milestone ? `✦ Nível ${celebration.level} ✦` : `Nível ${celebration.level}!`}
      </span>
    </div>
  )
}

export default LevelUpBurst
