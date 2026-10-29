import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLevelStore } from '../store/levelStore'
import { levelUpEffects, type MilestoneKind } from '../lib/levels'
import { anchorFrame, clipRect, frameEquals, type BurstFrame } from '../../call/lib/burstFrame'

/** Tamanho do avatar da lista de membros, base das medidas abaixo. */
const BASE_AVATAR = 32

/**
 * Marco no avatar: as faíscas viram partículas no tema da faixa (moedas,
 * folhas, cristais…) com um movimento próprio, e alguns marcos ganham anéis
 * a mais. É a versão pequena da animação que quem subiu vê na tela inteira.
 */
const MINI: Record<
  MilestoneKind,
  { shape: string; motion: string; ms: number; rings: number; size: number }
> = {
  coins: { shape: 'level-shape-coin', motion: 'level-mini-fall', ms: 1500, rings: 0, size: 7 },
  shockwave: { shape: 'rotate-45', motion: 'level-spark', ms: 1000, rings: 3, size: 5 },
  vines: { shape: 'level-shape-leaf', motion: 'level-mini-swirl', ms: 1600, rings: 0, size: 7 },
  ripple: { shape: 'level-shape-bubble', motion: 'level-mini-rise', ms: 1600, rings: 3, size: 6 },
  crystals: {
    shape: 'level-shape-shard',
    motion: 'level-mini-implode',
    ms: 1400,
    rings: 0,
    size: 8
  },
  fire: { shape: 'level-shape-flame', motion: 'level-mini-rise', ms: 1300, rings: 1, size: 7 },
  prism: { shape: 'level-shape-beam', motion: 'level-mini-beam', ms: 1500, rings: 0, size: 3 },
  blackhole: {
    shape: 'rounded-full',
    motion: 'level-mini-implode-explode',
    ms: 1700,
    rings: 1,
    size: 4
  },
  constellation: {
    shape: 'level-shape-star',
    motion: 'level-mini-twinkle',
    ms: 1600,
    rings: 0,
    size: 8
  },
  legendary: { shape: 'level-shape-star', motion: 'level-spark', ms: 1200, rings: 2, size: 8 }
}

/** Formas que já trazem o próprio fundo (gradiente no CSS). */
const OWN_BACKGROUND = new Set([
  'level-shape-coin',
  'level-shape-leaf',
  'level-shape-shard',
  'level-shape-flame',
  'level-shape-beam',
  'level-shape-bubble'
])

const SPECTRUM = ['#f87171', '#facc15', '#4ade80', '#60a5fa', '#c084fc']

/**
 * Animação de "subiu de nível" em volta do avatar (lista de membros e tile
 * da chamada): um halo na cor da faixa gira em volta do avatar e faíscas
 * saem dele. Faíscas, tamanho, brilho e cores crescem a cada nível
 * (levelUpEffects); do 20 em diante entram raios de luz atrás do avatar, do
 * 40 partículas em órbita. Nos marcos (10, 20…) as faíscas viram a versão
 * pequena da animação do marco (moedas, folhas, cristais…) com anéis de
 * choque. É o que os outros veem de você, sempre menor que a sua
 * celebração na janela.
 * O pai precisa ser `relative` com o tamanho do avatar (`size`, em px).
 *
 * O efeito em si vai num portal no <body>, `fixed` em cima do avatar: os
 * raios e o burst dos níveis altos são maiores que o tile da chamada e que
 * o painel de membros (ambos com overflow escondido) e seriam cortados.
 * Enquanto toca, segue o avatar quadro a quadro (o grid da chamada recentra,
 * a lista de membros muda) e fica invisível quando o avatar sai da área
 * visível dos containers que cortam. Continua click-through.
 */
function LevelUpBurst({
  userId,
  size = BASE_AVATAR
}: {
  userId: string
  size?: number
}): React.JSX.Element | null {
  const celebration = useLevelStore((s) => s.celebrations[userId])
  const anchorRef = useRef<HTMLSpanElement | null>(null)
  const [frame, setFrame] = useState<BurstFrame | null>(null)

  // Segue o avatar a cada quadro enquanto a animação está viva (o loop para
  // quando ela acaba ou o avatar desmonta); só re-renderiza se mudou.
  const active = celebration?.key
  useLayoutEffect(() => {
    const anchor = anchorRef.current
    if (active === undefined || !anchor) return
    // Containers que cortam o conteúdo (lista rolável, tile…): fora deles
    // o avatar não aparece, então o burst também não.
    const clips: Element[] = []
    for (let el = anchor.parentElement; el && el !== document.body; el = el.parentElement) {
      const style = getComputedStyle(el)
      if (style.overflowX !== 'visible' || style.overflowY !== 'visible') clips.push(el)
    }
    let last: BurstFrame | null = null
    let raf = 0
    const tick = (): void => {
      const viewport = { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight }
      const next = anchorFrame(
        anchor.getBoundingClientRect(),
        clipRect(
          viewport,
          clips.map((c) => c.getBoundingClientRect())
        )
      )
      if (!frameEquals(last, next)) {
        last = next
        setFrame(next)
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [active])

  const fx = useMemo(
    () => (celebration ? levelUpEffects(celebration.level, celebration.previous) : null),
    [celebration]
  )
  const k = (size / BASE_AVATAR) * (fx?.burstScale ?? 1)

  const sparks = useMemo(() => {
    if (!fx) return []
    const count = fx.sparks
    return Array.from({ length: count }, (_, i) => {
      const angle = (360 / count) * i + ((i * 37) % 13) - 6
      const dist = (22 + ((i * 53) % 14)) * k
      const rad = ((angle - 90) * Math.PI) / 180
      return {
        angle,
        dist,
        dx: Math.cos(rad) * dist,
        dy: Math.sin(rad) * dist,
        delay: (i % 4) * 40,
        big: i % 3 === 0,
        color: fx.colors[i % fx.colors.length]
      }
    })
  }, [fx, k])

  if (!celebration || !fx) return null

  const { tier } = fx
  const halo = 46 * k
  const dot = Math.max(1, Math.sqrt(k))
  const mini = fx.milestone ? MINI[fx.milestone.kind] : null
  const rings = mini ? Math.max(1, mini.rings) : 0
  const vars = {
    '--level-color': tier.color,
    '--level-accent': tier.accent
  } as React.CSSProperties

  const burst = (
    <span
      key={celebration.key}
      aria-live="polite"
      className="level-anim pointer-events-none fixed z-30"
      style={
        frame
          ? {
              ...vars,
              left: frame.left,
              top: frame.top,
              width: frame.width,
              height: frame.height,
              // Esconde sem desmontar: a animação segue no tempo certo.
              visibility: frame.visible ? undefined : 'hidden'
            }
          : vars
      }
    >
      <span className="sr-only">Subiu para o nível {celebration.level}</span>

      <span className="absolute left-1/2 top-1/2" style={{ opacity: fx.glow, width: 0, height: 0 }}>
        <span
          className="absolute left-1/2 top-1/2 rounded-full"
          style={{
            width: halo * 1.9,
            height: halo * 1.9,
            background: `radial-gradient(circle, ${tier.color}aa, ${tier.color}33 45%, transparent 70%)`,
            animation: 'level-glow 1.8s ease-out both'
          }}
        />
      </span>

      {fx.rays && (
        <span
          className="level-rays absolute left-1/2 top-1/2 rounded-full"
          style={{
            width: halo * 2.2,
            height: halo * 2.2,
            animation: 'level-rays 2.2s ease-out both'
          }}
        />
      )}

      {Array.from({ length: rings }, (_, i) => (
        <span
          key={`ring-${i}`}
          className="absolute left-1/2 top-1/2 rounded-full border-2"
          style={{
            width: halo,
            height: halo,
            borderColor:
              fx.milestone?.kind === 'legendary' ? SPECTRUM[(i * 2) % SPECTRUM.length] : tier.color,
            animation: `level-shockwave 1.1s ease-out ${150 + i * 220 + (fx.milestone?.kind === 'blackhole' ? 800 : 0)}ms both`
          }}
        />
      ))}

      <span
        className="level-halo absolute left-1/2 top-1/2 rounded-full"
        style={{ width: halo, height: halo, animation: 'level-halo 1.8s ease-out both' }}
      />

      {fx.orbit > 0 && (
        // Só o anel gira; as partículas ficam paradas dentro dele.
        <span
          className="absolute left-1/2 top-1/2"
          style={{
            width: halo * 1.4,
            height: halo * 1.4,
            animation: 'level-orbit 2.2s cubic-bezier(.3,.6,.4,1) 250ms both'
          }}
        >
          {Array.from({ length: fx.orbit }, (_, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 rounded-full"
              style={{
                width: (i % 2 === 0 ? 4 : 3) * dot,
                height: (i % 2 === 0 ? 4 : 3) * dot,
                background: i % 2 === 0 ? tier.color : '#ffffff',
                boxShadow: `0 0 8px ${tier.color}`,
                transform: `translate(-50%, -50%) rotate(${(360 / fx.orbit) * i}deg) translateY(${-halo * 0.7}px)`
              }}
            />
          ))}
        </span>
      )}

      {sparks.map((spark, i) => {
        const pieceSize = (mini ? mini.size : spark.big ? 5 : 3) * dot * (spark.big ? 1 : 0.75)
        const beam = mini?.motion === 'level-mini-beam'
        return (
          <span
            key={i}
            className={`absolute left-1/2 top-1/2 ${mini ? mini.shape : 'rotate-45 rounded-[1px]'}`}
            style={
              {
                '--angle': `${spark.angle}deg`,
                '--dist': `${spark.dist}px`,
                '--dx': `${spark.dx}px`,
                '--dy': `${spark.dy}px`,
                '--fall': `${spark.dist * 1.2}px`,
                '--beam': SPECTRUM[i % SPECTRUM.length],
                width: pieceSize,
                height: beam ? spark.dist * 1.3 : pieceSize,
                background: mini && OWN_BACKGROUND.has(mini.shape) ? undefined : spark.color,
                boxShadow: beam ? undefined : `0 0 6px ${tier.color}`,
                animation: `${mini ? mini.motion : 'level-spark'} ${mini ? mini.ms : 1000}ms cubic-bezier(.15,.8,.3,1) ${200 + spark.delay}ms both`
              } as React.CSSProperties
            }
          />
        )
      })}
    </span>
  )

  return (
    <span ref={anchorRef} aria-hidden="true" className="pointer-events-none absolute inset-0">
      {frame && createPortal(burst, document.body)}
    </span>
  )
}

export default LevelUpBurst
