import { useEffect, useMemo, useRef, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useLevelStore } from '../../store/levelStore'
import { levelUpEffects, RAINBOW, type MilestoneKind } from '../../lib/levels'
import { buildScene, DRAWS_NUMBER, IMPACT_MS } from './milestoneScenes'
import Crown from './Crown'

/** Quando o título entra em cada cena (ms): depois do "momento" dela. */
const TITLE_AT: Record<MilestoneKind, number> = {
  coins: 150,
  shockwave: 120,
  vines: 900,
  ripple: 520,
  crystals: 1500,
  fire: 150,
  prism: 700,
  blackhole: 1950,
  constellation: 2100,
  legendary: 650
}

const reducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false)

/**
 * Animação especial do marco (10, 20 … 100) quando VOCÊ chega nele: uma cena
 * diferente por faixa num <canvas> em tela cheia (moedas, onda dourada,
 * vinhas, água, cristais, fogo, prisma, buraco negro, constelação e a
 * sequência lendária) e o número do marco. Fica abaixo dos modais (z-40),
 * nunca recebe clique, para o requestAnimationFrame e sai do DOM quando
 * acaba. Com prefers-reduced-motion só o título aparece e some (fade).
 */
function LevelUpMilestone(): React.JSX.Element | null {
  const meId = useAuthStore((s) => s.user?.id)
  const celebration = useLevelStore((s) => (meId ? s.celebrations[meId] : undefined))
  const fx = useMemo(
    () => (celebration ? levelUpEffects(celebration.level, celebration.previous) : null),
    [celebration]
  )
  const milestone = fx?.milestone ?? null
  const key = celebration?.key
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [doneKey, setDoneKey] = useState<number | null>(null)
  const reduced = useMemo(() => (key === undefined ? false : reducedMotion()), [key])

  // Tamanho do número (o mesmo no canvas e no título em DOM).
  const layout = useMemo(() => {
    if (key === undefined || typeof window === 'undefined') return null
    const w = window.innerWidth
    const h = window.innerHeight
    return {
      w,
      h,
      cx: w / 2,
      cy: h * 0.46,
      fontPx: Math.round(Math.min(w * 0.24, h * 0.32, 280))
    }
  }, [key])

  // Some sozinha no fim da cena (a celebração pode durar mais, por causa da faixa).
  useEffect(() => {
    if (key === undefined || !milestone) return
    const timer = setTimeout(() => setDoneKey(key), milestone.durationMs)
    return () => clearTimeout(timer)
  }, [key, milestone])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !milestone || !fx || !layout || reduced) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    canvas.width = Math.round(layout.w * dpr)
    canvas.height = Math.round(layout.h * dpr)
    const scene = buildScene(milestone.kind, {
      ...layout,
      level: milestone.level,
      color: milestone.tier.color,
      accent: milestone.tier.accent,
      colors: fx.colors,
      budget: fx.milestoneParticles,
      power: fx.power,
      durationMs: milestone.durationMs
    })
    canvas.dataset.particles = String(scene.particles)
    let raf = 0
    let start: number | null = null
    const frame = (now: number): void => {
      if (start === null) start = now
      const t = now - start
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, layout.w, layout.h)
      if (t >= milestone.durationMs) return // acabou: não pede outro quadro
      scene.draw(ctx, t)
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [milestone, fx, layout, reduced])

  if (!celebration || !fx || !milestone || !layout || doneKey === celebration.key) return null

  const { tier, kind } = milestone
  const titleAt = reduced ? 0 : TITLE_AT[kind]
  const showNumber = reduced || !DRAWS_NUMBER.has(kind)
  const legendary = kind === 'legendary'
  const gradient = legendary
    ? `linear-gradient(90deg, ${RAINBOW.join(', ')})`
    : `linear-gradient(180deg, #ffffff 0%, ${tier.color} 45%, ${tier.accent} 100%)`

  return (
    <div
      key={celebration.key}
      aria-hidden="true"
      data-milestone={kind}
      className={`level-anim pointer-events-none fixed inset-0 z-40 overflow-hidden ${reduced ? 'level-fade' : ''}`}
      style={
        {
          '--level-fade-ms': `${milestone.durationMs}ms`,
          '--shake': `${Math.min(6, fx.shake + 1)}px`
        } as React.CSSProperties
      }
    >
      <div
        className="absolute inset-0"
        style={{ animation: `level-shake 600ms linear ${IMPACT_MS[kind]}ms both` }}
      >
        {!reduced && <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />}

        <div
          className="absolute left-1/2 flex flex-col items-center"
          style={{
            top: layout.cy,
            transform: 'translate(-50%, -50%)'
          }}
        >
          <div
            className="flex flex-col items-center"
            style={{
              animation: `level-ms-title ${milestone.durationMs - titleAt}ms cubic-bezier(.3,1.3,.5,1) ${titleAt}ms both`
            }}
          >
            {legendary && <Crown size={Math.round(layout.fontPx * 0.45)} />}
            <p
              className="bg-clip-text font-black leading-none tracking-tight text-transparent"
              style={{
                fontSize: legendary ? layout.fontPx * 0.42 : layout.fontPx,
                letterSpacing: legendary ? '0.18em' : undefined,
                backgroundImage: gradient,
                visibility: showNumber ? undefined : 'hidden',
                filter: `drop-shadow(0 4px 24px ${tier.color}aa)`
              }}
            >
              {legendary ? 'LENDÁRIO' : milestone.level}
            </p>
            <p
              className="mt-2 rounded-full border px-4 py-1 text-xs font-extrabold uppercase tracking-[0.3em] text-white shadow-lg"
              style={{
                borderColor: `${tier.color}88`,
                background: `linear-gradient(90deg, ${tier.accent}cc, ${tier.color}aa)`,
                textShadow: '0 1px 2px rgba(0,0,0,.6)'
              }}
            >
              {legendary
                ? `Nível ${milestone.level}`
                : `Marco ${milestone.level} · ${milestone.title}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LevelUpMilestone
