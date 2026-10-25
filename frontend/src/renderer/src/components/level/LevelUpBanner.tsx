import { useEffect, useMemo } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useLevelStore } from '../../store/levelStore'
import { isMilestone, levelUpEffects, type LevelTier } from '../../lib/levels'
import { oncePerKey, playSound } from '../../lib/sounds'
import LevelBadge from './LevelBadge'

/** Emblema da faixa (80+): escudo com estrela, nas cores da faixa. */
function TierEmblem({ tier, size }: { tier: LevelTier; size: number }): React.JSX.Element {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <linearGradient id="level-emblem-fill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={tier.color} stopOpacity="0.55" />
          <stop offset="1" stopColor={tier.accent} stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <polygon
        points="50,3 91,26 91,74 50,97 9,74 9,26"
        fill="url(#level-emblem-fill)"
        stroke={tier.color}
        strokeWidth="2.5"
        strokeOpacity="0.8"
      />
      <polygon
        points="50,22 57,41 77,41 61,53 67,72 50,61 33,72 39,53 23,41 43,41"
        fill={tier.color}
        fillOpacity="0.75"
      />
    </svg>
  )
}

// Em dev o StrictMode roda o efeito duas vezes: o som toca uma vez por subida.
const firstPlay = oncePerKey()

/**
 * Faixa no topo da janela quando VOCÊ sobe de nível: aparece mesmo que você
 * esteja num canal de texto e não esteja vendo o seu tile na chamada. Cresce
 * com o nível (levelUpEffects): do 40 em diante a borda gira na cor da faixa
 * e toca um chime, do 60 sai confete, do 80 um emblema grande aparece atrás.
 * Entrando numa faixa nova, mostra "Nova faixa: <nome>!".
 */
function LevelUpBanner(): React.JSX.Element | null {
  const meId = useAuthStore((s) => s.user?.id)
  const celebration = useLevelStore((s) => (meId ? s.celebrations[meId] : undefined))

  const fx = useMemo(
    () => (celebration ? levelUpEffects(celebration.level, celebration.previous) : null),
    [celebration]
  )

  // O som toca mesmo com prefers-reduced-motion (só a animação some).
  const chime = fx?.chime
  const key = celebration?.key
  useEffect(() => {
    if (key !== undefined && chime && firstPlay(key)) playSound(chime)
  }, [key, chime])

  const confetti = useMemo(() => {
    if (!fx) return []
    return Array.from({ length: fx.confetti }, (_, i) => {
      // Leque para cima e para os lados; depois cai (keyframe level-confetti).
      const angle = ((-170 + (160 / Math.max(1, fx.confetti - 1)) * i) * Math.PI) / 180
      const reach = 110 + ((i * 37) % 90)
      return {
        dx: Math.cos(angle) * reach,
        dy: Math.sin(angle) * (20 + ((i * 29) % 40)),
        rot: (i % 2 === 0 ? 1 : -1) * (300 + ((i * 53) % 360)),
        wide: i % 3 === 0,
        color: [fx.tier.color, fx.tier.accent, '#ffffff'][i % 3],
        delay: 250 + (i % 5) * 35
      }
    })
  }, [fx])

  if (!meId || !celebration || !fx) return null

  const { tier } = fx
  const milestone = isMilestone(celebration.level)
  const vars = {
    '--level-color': tier.color,
    '--level-accent': tier.accent,
    '--level-fade-ms': `${fx.durationMs}ms`
  } as React.CSSProperties

  const content = (
    <>
      <span
        aria-hidden="true"
        className="level-motion absolute inset-y-0 w-1/3"
        style={{
          background: `linear-gradient(90deg, transparent, ${tier.color}33, transparent)`,
          animation: 'level-shimmer 1.4s ease-in-out 300ms 2 both'
        }}
      />
      <span className="relative text-xl" aria-hidden="true">
        {fx.legendary ? '👑' : milestone ? '🏆' : '⬆️'}
      </span>
      <div className="relative leading-tight">
        <p className="text-sm font-bold text-white">
          {milestone ? 'Marco alcançado!' : 'Você subiu de nível!'}
        </p>
        <p className="text-[11px] text-gray-400">Faixa {tier.name}</p>
      </div>
      <LevelBadge userId={meId} size="md" className="relative" />
    </>
  )

  return (
    <div
      key={celebration.key}
      role="status"
      className="level-anim level-fade pointer-events-none fixed inset-x-0 top-[calc(var(--titlebar-height,0px)+1rem)] z-50 flex flex-col items-center gap-2"
      style={vars}
    >
      <div
        className="relative"
        style={{ animation: `level-banner ${fx.durationMs}ms ease-in-out both` }}
      >
        {fx.emblem && (
          <span
            className="level-motion absolute left-1/2 top-1/2"
            style={{
              animation: `level-emblem ${Math.min(2600, fx.durationMs)}ms ease-out 150ms both`
            }}
          >
            <TierEmblem tier={tier} size={200} />
          </span>
        )}

        {fx.bannerBorder ? (
          // Borda girando: um quadrado de gradiente maior que a faixa gira
          // atrás do conteúdo e só os 2px da borda aparecem.
          <div
            className="relative overflow-hidden rounded-2xl p-[2px]"
            style={{ boxShadow: `0 0 32px ${tier.color}66` }}
          >
            <span
              aria-hidden="true"
              className="level-motion absolute left-1/2 top-1/2 aspect-square w-[160%]"
              style={{
                background: `conic-gradient(from 0deg, ${tier.color}, transparent 25%, ${tier.accent} 50%, transparent 75%, ${tier.color})`,
                animation: 'level-border-spin 1.8s linear infinite'
              }}
            />
            <div className="relative flex items-center gap-3 overflow-hidden rounded-[14px] bg-[#0b0b10]/95 px-4 py-2.5 backdrop-blur-xl">
              {content}
            </div>
          </div>
        ) : (
          <div
            className="relative flex items-center gap-3 overflow-hidden rounded-2xl border bg-[#0b0b10]/90 px-4 py-2.5 shadow-2xl backdrop-blur-xl"
            style={{ borderColor: `${tier.color}66`, boxShadow: `0 0 28px ${tier.color}55` }}
          >
            {content}
          </div>
        )}

        {confetti.map((piece, i) => (
          <span
            key={i}
            aria-hidden="true"
            className="level-motion absolute left-1/2 top-1/2 rounded-[1px]"
            style={
              {
                '--dx': `${piece.dx}px`,
                '--dy': `${piece.dy}px`,
                '--rot': `${piece.rot}deg`,
                width: piece.wide ? 9 : 5,
                height: piece.wide ? 4 : 9,
                background: piece.color,
                animation: `level-confetti 1.9s cubic-bezier(.2,.7,.4,1) ${piece.delay}ms both`
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {fx.tierReveal && (
        <p
          className="rounded-full border px-3 py-1 text-xs font-extrabold uppercase tracking-[0.18em] text-white shadow-lg"
          style={{
            borderColor: `${tier.color}88`,
            background: `linear-gradient(90deg, ${tier.accent}cc, ${tier.color}cc)`,
            textShadow: '0 1px 2px rgba(0,0,0,.5)',
            animation: `level-reveal ${fx.durationMs}ms ease-out both`
          }}
        >
          Nova faixa: {fx.tierReveal}!
        </p>
      )}
    </div>
  )
}

export default LevelUpBanner
