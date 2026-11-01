import { drawGlow, easeOut, prog, sparkle } from '../../levels/lib/sceneKit'
import { IMPACT_MS, tail, type LayerBuilder } from './serverSceneCore'

/**
 * Camadas cósmicas da subida de nível do servidor: a galáxia girando em
 * volta do ícone (20+) e, na faixa lendária (30+), a aurora no alto da tela
 * com anéis inclinados girando em volta do ícone.
 */

interface Star {
  arm: number
  dist: number
  offset: number
  size: number
  color: string
}

const ARMS = 3

/** Galáxia espiral girando em volta do ícone (20+). */
export const galaxyLayer: LayerBuilder = (env, r, budget) => {
  const radius = Math.min(env.w, env.h) * 0.44
  const stars: Star[] = Array.from({ length: budget }, (_, i) => ({
    arm: i % ARMS,
    dist: 0.12 + r() * 0.88,
    offset: (r() - 0.5) * 0.5,
    size: 4 + r() * 7,
    color: env.palette[i % env.palette.length]
  }))
  return {
    particles: stars.length,
    draw: (ctx, t) => {
      const grow = easeOut(prog(t, IMPACT_MS, IMPACT_MS + 900))
      if (grow <= 0) return
      const fade = tail(env, t)
      drawGlow(ctx, env.color, env.cx, env.cy, radius * 0.9 * grow, 0.45 * fade)
      drawGlow(ctx, env.palette[1], env.cx, env.cy, radius * 0.5 * grow, 0.4 * fade)
      for (const s of stars) {
        const spin = t * 0.0007 * (1.6 - s.dist)
        const a = (s.arm * Math.PI * 2) / ARMS + s.dist * 3.2 + s.offset + spin
        const d = s.dist * radius * grow
        // Galáxia achatada (inclinada), como vista de lado.
        drawGlow(
          ctx,
          s.color,
          env.cx + Math.cos(a) * d,
          env.cy + Math.sin(a) * d * 0.55,
          s.size,
          fade
        )
      }
    }
  }
}

const AURORA_BANDS = 3
const AURORA_STEPS = 24

/** Aurora no alto da tela, anéis girando e estrelas piscando (30+). */
export const auroraLayer: LayerBuilder = (env, r, budget) => {
  const twinkles = Array.from({ length: budget }, (_, i) => ({
    x: r() * env.w,
    y: r() * env.h * 0.6,
    size: 5 + r() * 9,
    at: IMPACT_MS + r() * env.durationMs * 0.6,
    color: i % 2 === 0 ? '#ffffff' : env.palette[i % env.palette.length]
  }))
  return {
    particles: twinkles.length,
    draw: (ctx, t) => {
      const fade = tail(env, t) * prog(t, 200, 1200)
      if (fade <= 0) return
      drawAurora(ctx, env.w, env.h, env.palette, t, fade)
      drawHaloRings(ctx, env.cx, env.cy, env.icon, env.palette, t, fade)
      for (const s of twinkles) {
        const a = prog(t, s.at, s.at + 250) * (1 - prog(t, s.at + 350, s.at + 900))
        sparkle(ctx, s.x, s.y, s.size, s.color, a * fade, t * 0.002)
      }
    }
  }
}

/** Traço de cada cortina da aurora: largo e fraco, depois fino e forte (brilho sem blur). */
const AURORA_STROKES: [number, number][] = [
  [0.09, 0.08],
  [0.045, 0.16],
  [0.012, 0.5]
]

function auroraWave(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  band: number,
  t: number
): void {
  ctx.beginPath()
  for (let i = 0; i <= AURORA_STEPS; i++) {
    const x = (i / AURORA_STEPS) * w
    const wave = Math.sin(i * 0.5 + t * 0.0018 * (band + 1) + band * 2) * h * 0.05
    const y = h * (0.12 + band * 0.07) + wave
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
}

function drawAurora(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  palette: string[],
  t: number,
  fade: number
): void {
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  for (let b = 0; b < AURORA_BANDS; b++) {
    ctx.strokeStyle = palette[(b * 2) % palette.length]
    auroraWave(ctx, w, h, b, t)
    for (const [width, alpha] of AURORA_STROKES) {
      ctx.lineWidth = Math.max(2, h * width)
      ctx.globalAlpha = alpha * fade
      ctx.stroke()
    }
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
}

const HALO_RINGS = 3

function drawHaloRings(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  icon: number,
  palette: string[],
  t: number,
  fade: number
): void {
  const grow = easeOut(prog(t, IMPACT_MS, IMPACT_MS + 900))
  ctx.lineWidth = 2.5
  for (let i = 0; i < HALO_RINGS; i++) {
    ctx.globalAlpha = 0.75 * fade * grow
    ctx.strokeStyle = palette[(i + 1) % palette.length]
    const rx = icon * (1.9 + i * 0.55) * grow
    ctx.beginPath()
    ctx.ellipse(
      cx,
      cy,
      rx,
      rx * 0.32,
      (i * Math.PI) / 3 + t * 0.0009 * (i % 2 ? -1 : 1),
      0,
      Math.PI * 2
    )
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}
