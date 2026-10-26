import { useMemo } from 'react'
import { levelUpEffects, RAINBOW } from '../../lib/levels'
import Crown from './Crown'
import { useScreenCelebration } from './useScreenCelebration'

/** Duração da celebração lendária em tela cheia. */
const LEGENDARY_MS = 4000

/**
 * Efeitos na janela inteira quando VOCÊ sobe de nível alto: do 80 em diante
 * um pulso de vinheta na cor da faixa; no 100+ (Lendário) uma celebração de
 * ~4 s com aurora de arco-íris, estrelas caindo, coroa e "LENDÁRIO". Tudo
 * pointer-events: none — nunca bloqueia o app — e sai do DOM quando acaba.
 */
function LevelUpScreen(): React.JSX.Element | null {
  const celebration = useScreenCelebration()

  const fx = useMemo(
    () => (celebration ? levelUpEffects(celebration.level, celebration.previous) : null),
    [celebration]
  )

  const stars = useMemo(
    () =>
      Array.from({ length: fx?.stars ?? 0 }, (_, i) => ({
        left: (i * 71 + 7) % 100,
        size: 12 + ((i * 13) % 16),
        color: RAINBOW[i % RAINBOW.length],
        duration: 2200 + ((i * 37) % 1000),
        delay: (i * 173) % 1500,
        rot: (i % 2 === 0 ? 1 : -1) * (180 + ((i * 41) % 240))
      })),
    [fx]
  )

  if (!celebration || !fx || (!fx.vignette && !fx.legendary)) return null

  const { tier } = fx

  return (
    <div
      key={celebration.key}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-40"
    >
      {fx.vignette && (
        <div
          className="level-anim level-fade absolute inset-0"
          style={
            {
              '--level-fade-ms': '1800ms',
              background: `radial-gradient(ellipse at center, transparent ${Math.round(62 - 14 * fx.glow)}%, ${tier.color}40 78%, ${tier.color}aa 100%)`,
              animation: 'level-vignette 1.8s ease-in-out both'
            } as React.CSSProperties
          }
        />
      )}

      {fx.legendary && (
        <div
          className="level-anim level-fade absolute inset-0 overflow-hidden"
          style={{ '--level-fade-ms': `${LEGENDARY_MS}ms` } as React.CSSProperties}
        >
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at center, rgba(10,6,20,.55), rgba(10,6,20,.15) 60%, transparent), linear-gradient(120deg, ${RAINBOW.map((c) => `${c}33`).join(', ')})`,
              animation: `level-wash ${LEGENDARY_MS}ms ease-in-out both`
            }}
          />
          {[0, 1].map((band) => (
            <div
              key={band}
              className="level-motion absolute -top-1/4 h-[150%] w-[45%]"
              style={{
                left: band === 0 ? '10%' : '45%',
                background: `linear-gradient(90deg, transparent, ${RAINBOW.join(', ')}, transparent)`,
                filter: 'blur(48px)',
                animation: `level-aurora ${band === 0 ? 3200 : 3600}ms ease-in-out ${band * 400}ms both`
              }}
            />
          ))}
          {stars.map((star, i) => (
            <span
              key={i}
              className="level-motion absolute top-0 leading-none"
              style={
                {
                  '--rot': `${star.rot}deg`,
                  left: `${star.left}%`,
                  fontSize: star.size,
                  color: star.color,
                  textShadow: `0 0 10px ${star.color}`,
                  animation: `level-star-fall ${star.duration}ms linear ${star.delay}ms both`
                } as React.CSSProperties
              }
            >
              ✦
            </span>
          ))}
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-2"
            style={{ animation: `level-crown ${LEGENDARY_MS}ms cubic-bezier(.3,1.4,.5,1) both` }}
          >
            <Crown />
            <p
              className="bg-clip-text text-6xl font-black tracking-[0.2em] text-transparent"
              style={{
                backgroundImage: `linear-gradient(90deg, ${RAINBOW.join(', ')})`,
                filter: 'drop-shadow(0 2px 12px rgba(244,114,182,.55))'
              }}
            >
              LENDÁRIO
            </p>
            <p className="text-sm font-bold uppercase tracking-[0.3em] text-white/90">
              Nível {celebration.level}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

export default LevelUpScreen
