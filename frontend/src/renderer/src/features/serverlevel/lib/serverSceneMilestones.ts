import { drawGlow, easeIn, easeOut, prog, window4 } from '../../levels/lib/sceneKit'
import type { ServerMilestone } from './serverLevelScene'
import { IMPACT_MS, tail, type LayerBuilder, type ServerEnv } from './serverSceneCore'

/**
 * Cenas exclusivas dos marcos do servidor, por cima das camadas da faixa:
 * 10 coroa de raios · 25 supernova · 50 eclipse · 100 big bang.
 */

interface Debris {
  angle: number
  speed: number
  size: number
  color: string
}

function debris(env: ServerEnv, r: () => number, count: number): Debris[] {
  return Array.from({ length: count }, (_, i) => ({
    angle: r() * Math.PI * 2,
    speed: 0.25 + r() * 0.75,
    size: 3 + r() * 7,
    color: i % 4 === 0 ? '#ffffff' : env.palette[i % env.palette.length]
  }))
}

/** Detritos voando do centro a partir de `at` (com rastro). */
function drawDebris(
  ctx: CanvasRenderingContext2D,
  env: ServerEnv,
  list: Debris[],
  t: number,
  at: number
): void {
  const p = prog(t, at, at + 2200)
  if (p <= 0 || p >= 1) return
  const reach = Math.hypot(env.w, env.h) * 0.7 * easeOut(p)
  const fade = (1 - p) * tail(env, t)
  for (const d of list) {
    const dist = reach * d.speed
    const x = env.cx + Math.cos(d.angle) * dist
    const y = env.cy + Math.sin(d.angle) * dist
    drawGlow(ctx, d.color, x, y, d.size, fade)
    drawGlow(
      ctx,
      d.color,
      x - Math.cos(d.angle) * 18,
      y - Math.sin(d.angle) * 18,
      d.size * 0.6,
      fade * 0.5
    )
  }
}

/** Tela inteira de uma cor, com alfa. */
function wash(ctx: CanvasRenderingContext2D, env: ServerEnv, color: string, alpha: number): void {
  if (alpha <= 0) return
  ctx.globalAlpha = alpha
  ctx.fillStyle = color
  ctx.fillRect(0, 0, env.w, env.h)
  ctx.globalAlpha = 1
}

const SPIKES = 12

/** 10: coroa de raios pulsando em volta do ícone. */
const coroa: LayerBuilder = (env, r, budget) => {
  const sparks = debris(env, r, budget)
  return {
    particles: sparks.length,
    draw: (ctx, t) => {
      const grow = easeOut(prog(t, IMPACT_MS, IMPACT_MS + 500)) * tail(env, t)
      if (grow <= 0) return
      ctx.lineWidth = 3
      ctx.strokeStyle = '#ffffff'
      for (let i = 0; i < SPIKES; i++) {
        const a = (i * Math.PI * 2) / SPIKES + t * 0.0006
        const pulse = 1 + 0.25 * Math.sin(t * 0.02 + i)
        const inner = env.icon * 1.15
        const outer = env.icon * (1.6 + (i % 2) * 0.5) * pulse
        ctx.globalAlpha = grow
        ctx.beginPath()
        ctx.moveTo(env.cx + Math.cos(a) * inner, env.cy + Math.sin(a) * inner)
        ctx.lineTo(
          env.cx + Math.cos(a + 0.08) * (inner + outer) * 0.5,
          env.cy + Math.sin(a + 0.08) * (inner + outer) * 0.5
        )
        ctx.lineTo(env.cx + Math.cos(a) * outer, env.cy + Math.sin(a) * outer)
        ctx.stroke()
        drawGlow(
          ctx,
          env.palette[i % env.palette.length],
          env.cx + Math.cos(a) * outer,
          env.cy + Math.sin(a) * outer,
          10,
          grow
        )
      }
      ctx.globalAlpha = 1
      drawDebris(ctx, env, sparks, t, IMPACT_MS)
    }
  }
}

/** 25: clarão branco que toma a tela e um anel gigante de detritos. */
const supernova: LayerBuilder = (env, r, budget) => {
  const list = debris(env, r, budget)
  return {
    particles: list.length,
    draw: (ctx, t) => {
      wash(
        ctx,
        env,
        '#ffffff',
        0.7 * window4(t, IMPACT_MS, IMPACT_MS + 120, IMPACT_MS + 250, IMPACT_MS + 1100)
      )
      drawGlow(
        ctx,
        '#ffffff',
        env.cx,
        env.cy,
        env.icon * 8 * easeOut(prog(t, IMPACT_MS, IMPACT_MS + 900)),
        0.8 * tail(env, t)
      )
      drawDebris(ctx, env, list, t, IMPACT_MS + 100)
    }
  }
}

/** 50: o ícone é eclipsado por um disco escuro com coroa solar e o "anel de diamante". */
const eclipse: LayerBuilder = (env, r, budget) => {
  const list = debris(env, r, budget)
  const shift = env.icon * 4
  return {
    particles: list.length,
    draw: (ctx, t) => {
      const fade = tail(env, t)
      const cover = window4(t, 200, IMPACT_MS + 200, IMPACT_MS + 900, IMPACT_MS + 1700)
      drawGlow(
        ctx,
        '#fde68a',
        env.cx,
        env.cy,
        env.icon * (3 + 2 * cover),
        (0.4 + 0.6 * cover) * fade
      )
      // O disco escuro passa da esquerda para a direita.
      const x = env.cx - shift + 2 * shift * easeOut(prog(t, 0, IMPACT_MS + 1700))
      ctx.globalAlpha = 0.9 * cover
      ctx.fillStyle = '#05030a'
      ctx.beginPath()
      ctx.arc(x, env.cy, env.icon * 1.25, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
      const diamond = window4(
        t,
        IMPACT_MS + 800,
        IMPACT_MS + 900,
        IMPACT_MS + 950,
        IMPACT_MS + 1300
      )
      drawGlow(
        ctx,
        '#ffffff',
        env.cx + env.icon * 1.2,
        env.cy - env.icon * 0.5,
        env.icon * 1.4,
        diamond
      )
      drawDebris(ctx, env, list, t, IMPACT_MS + 900)
    }
  }
}

/** 100: tudo é sugado para um ponto, a tela apaga e o universo explode. */
const bigbang: LayerBuilder = (env, r, budget) => {
  const inward = debris(env, r, Math.floor(budget / 2))
  const outward = debris(env, r, budget - inward.length)
  const bang = IMPACT_MS + 300
  const reach = Math.hypot(env.w, env.h) * 0.6
  return {
    particles: inward.length + outward.length,
    draw: (ctx, t) => {
      wash(ctx, env, '#000000', 0.75 * window4(t, 0, IMPACT_MS, bang, bang + 400))
      const p = easeIn(prog(t, 0, bang))
      if (p < 1) {
        for (const d of inward) {
          const dist = reach * d.speed * (1 - p)
          drawGlow(
            ctx,
            d.color,
            env.cx + Math.cos(d.angle) * dist,
            env.cy + Math.sin(d.angle) * dist,
            d.size,
            p
          )
        }
      }
      wash(ctx, env, '#ffffff', 0.85 * window4(t, bang, bang + 90, bang + 160, bang + 900))
      drawDebris(ctx, env, outward, t, bang)
    }
  }
}

export const MILESTONE_LAYERS: Record<ServerMilestone, LayerBuilder> = {
  coroa,
  supernova,
  eclipse,
  bigbang
}
