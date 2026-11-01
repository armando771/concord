import { useEffect } from 'react'
import { useLevelStore } from '../store/levelStore'
import { levelTier, levelUpEffects } from '../lib/levels'
import { badgeShadow, levelBadgeStyle } from '../lib/levelBadgeStyle'
import type { Celebration } from '../store/levelStore'
import './levelSpecial.css'

interface LevelBadgeProps {
  userId: string
  size?: 'sm' | 'md'
  className?: string
  /** Com isso o selo vira um botão (ex.: tocar a animação do nível). */
  onClick?: () => void
}

/** Quantos números o contador passa antes de parar no nível novo. */
const ROLL_STEPS = 6

/**
 * O número do selo: parado; ou o antigo saindo por cima e o novo entrando
 * por baixo; ou, do 20 em diante, rolando como contador até o novo.
 */
function LevelNumber({
  level,
  celebration
}: {
  level: number
  celebration: Celebration | undefined
}): React.JSX.Element {
  const changed = celebration !== undefined && celebration.previous !== level
  const rolling = changed && levelUpEffects(level).rollNumber
  const rollFrom = Math.max(0, level - ROLL_STEPS)
  return (
    <span className="relative inline-flex overflow-hidden">
      {rolling ? (
        <span
          className="level-roll flex flex-col tabular-nums"
          style={
            {
              '--roll': level - rollFrom,
              height: '1em',
              animation: 'level-roll 1.1s cubic-bezier(.12,.8,.2,1) 300ms both'
            } as React.CSSProperties
          }
        >
          {Array.from({ length: level - rollFrom + 1 }, (_, i) => (
            <span key={i} aria-hidden={i < level - rollFrom} className="block h-[1em] shrink-0">
              {rollFrom + i}
            </span>
          ))}
        </span>
      ) : changed ? (
        <>
          <span
            aria-hidden="true"
            className="level-num-old absolute inset-0"
            style={{ animation: 'level-num-out 450ms ease-in 250ms both' }}
          >
            {celebration.previous}
          </span>
          <span style={{ animation: 'level-num-in 450ms cubic-bezier(.2,1.4,.5,1) 450ms both' }}>
            {level}
          </span>
        </>
      ) : (
        level
      )}
    </span>
  )
}

/**
 * Selo "Nv 12" com a cor da faixa (ou o selo especial do nível, ver
 * levelBadgeStyle). Quando a pessoa sobe de nível, o selo
 * pula e o número antigo sai por cima enquanto o novo entra por baixo; do
 * 20 em diante o número rola como um contador até o novo.
 */
function LevelBadge({
  userId,
  size = 'sm',
  className = '',
  onClick
}: LevelBadgeProps): React.JSX.Element | null {
  const level = useLevelStore((s) => s.levels[userId])
  const celebration = useLevelStore((s) => s.celebrations[userId])
  const ensureLevels = useLevelStore((s) => s.ensureLevels)

  useEffect(() => {
    ensureLevels([userId])
  }, [userId, ensureLevels])

  if (level === undefined) return null

  const tier = levelTier(level)
  const look = levelBadgeStyle(level)
  const text = size === 'md' ? 'text-[11px] px-1.5 py-0.5' : 'text-[9px] px-1 py-px'

  const title = `Nível ${level} · ${tier.name}`
  const wrapperProps = onClick
    ? ({
        role: 'button',
        tabIndex: 0,
        title: `${title} · clique para ver a animação`,
        'aria-label': `Tocar a animação do nível ${level}`,
        onClick,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key !== 'Enter' && e.key !== ' ') return
          e.preventDefault()
          onClick()
        }
      } as const)
    : { title }

  return (
    <span
      key={celebration?.key}
      {...wrapperProps}
      className={`level-anim inline-flex shrink-0 ${
        onClick
          ? 'cursor-pointer rounded-md transition-transform hover:scale-105 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-fg/70'
          : ''
      } ${className}`}
      style={
        celebration
          ? { animation: 'level-badge-pop 900ms cubic-bezier(.3,1.6,.5,1) 200ms both' }
          : undefined
      }
    >
      <span
        data-badge={look.variant}
        className={`inline-flex items-center gap-0.5 rounded-md font-extrabold leading-none tracking-wide ${text} ${look.className}`}
        style={{ ...look.style, boxShadow: badgeShadow(look, celebration !== undefined) }}
      >
        <span className={look.dimLabel ? 'opacity-70' : 'opacity-90'}>Nv</span>
        <LevelNumber level={level} celebration={celebration} />
      </span>
    </span>
  )
}

export default LevelBadge
