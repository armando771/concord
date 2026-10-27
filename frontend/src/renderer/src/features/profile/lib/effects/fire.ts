// Fogo: línguas de chama subindo da base até ~45–50% da altura, balançando
// para os lados, com um núcleo amarelo-branco quente embaixo, e faíscas
// soltas que sobem mais alto que as chamas e esfriam de amarelo → cor →
// vermelho escuro. Tudo em 'lighter'.
import type { Ctx, EffectParams, Rand, Scene } from './types'
import { between, countFor, hexRgb, mix, rgba, TAU, type RGB } from './util'

export interface Tongue {
  x: number
  width: number
  /** Altura média, em px. */
  height: number
  phase: number
  freq: number
  sway: number
}

export interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  max: number
  size: number
  wob: number
}

export interface FireState {
  w: number
  h: number
  t: number
  tongues: Tongue[]
  sparks: Spark[]
  palette: string[]
  /** Paradas do degradê das chamas (de baixo para cima). */
  outer: string[]
  core: string[]
}

export const FIRE_MAX = 160
/** Topo das chamas, em fração da altura a partir da base. */
export const FLAME_TOP = 0.4
const SHADES = 16
const HOT: RGB = [255, 250, 220]
const YELLOW: RGB = [255, 214, 90]
const DARK: RGB = [110, 12, 0]

/** Tons das faíscas, do nascimento (claro) até o fim da vida (escuro). */
function sparkPalette(color: RGB): string[] {
  const out: string[] = []
  for (let i = 0; i < SHADES; i++) {
    const t = i / (SHADES - 1)
    const c = t < 0.4 ? mix(YELLOW, color, t / 0.4) : mix(color, DARK, (t - 0.4) / 0.6)
    out.push(rgba(c, 1))
  }
  return out
}

function newTongue(i: number, n: number, w: number, h: number, rand: Rand): Tongue {
  const gap = w / n
  return {
    x: gap * (i + 0.5) + between(rand, -0.3, 0.3) * gap,
    width: gap * between(rand, 1.6, 2.4),
    height: h * between(rand, 0.2, 0.32),
    phase: rand() * TAU,
    freq: between(rand, 2.5, 4.5),
    sway: gap * between(rand, 0.3, 0.6)
  }
}

function spawnSpark(e: Spark, w: number, h: number, rand: Rand): void {
  e.x = rand() * w
  e.y = h - rand() * h * 0.12
  e.vx = between(rand, -14, 14)
  e.vy = -h * between(rand, 0.2, 0.36)
  e.max = between(rand, 0.9, 2)
  e.life = 0
  e.size = between(rand, 1, 2.6)
  e.wob = rand() * TAU
}

function newSpark(w: number, h: number, rand: Rand): Spark {
  const e: Spark = { x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 1, wob: 0 }
  spawnSpark(e, w, h, rand)
  // Já abre no meio da vida, para não começar vazio.
  e.life = rand() * e.max
  e.y += e.vy * e.life
  return e
}

function stepSpark(e: Spark, s: FireState, dt: number, rand: Rand): void {
  e.life += dt
  if (e.life >= e.max) {
    spawnSpark(e, s.w, s.h, rand)
    return
  }
  e.x += (e.vx + Math.sin(s.t * 4 + e.wob) * 22) * dt
  e.y += e.vy * dt
}

/** Altura da língua agora: respira devagar e tremula rápido. */
export function tongueHeight(g: Tongue, t: number): number {
  const slow = Math.sin(t * g.freq + g.phase) * 0.18
  const fast = Math.sin(t * g.freq * 3.1 + g.phase * 1.7) * 0.08
  return g.height * (1 + slow + fast)
}

/** Gota pontuda: base larga em y = h, ponta deslocada pelo balanço. */
function traceTongue(ctx: Ctx, s: FireState, g: Tongue, scale: number): void {
  const half = (g.width * scale) / 2
  const top = s.h - tongueHeight(g, s.t) * scale
  const tip = g.x + Math.sin(s.t * 1.9 + g.phase) * g.sway * scale
  const mid = s.h - (s.h - top) * 0.45
  const neck = top + (s.h - top) * 0.3
  ctx.beginPath()
  ctx.moveTo(g.x - half, s.h)
  ctx.bezierCurveTo(g.x - half, mid, tip - half * 0.5, neck, tip, top)
  ctx.bezierCurveTo(tip + half * 0.5, neck, g.x + half, mid, g.x + half, s.h)
  ctx.closePath()
}

function flameGradient(ctx: Ctx, s: FireState, stops: string[], reach: number): CanvasGradient {
  const g = ctx.createLinearGradient(0, s.h, 0, s.h * (1 - reach))
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c))
  return g
}

function drawTongues(ctx: Ctx, s: FireState, stops: string[], scale: number): void {
  ctx.fillStyle = flameGradient(ctx, s, stops, FLAME_TOP * scale)
  for (const g of s.tongues) {
    traceTongue(ctx, s, g, scale)
    ctx.fill()
  }
}

function drawSpark(ctx: Ctx, s: FireState, e: Spark): void {
  const k = Math.min(1, e.life / e.max)
  const flicker = 0.7 + 0.3 * Math.sin(e.life * 30 + e.wob)
  ctx.globalAlpha = (1 - k) * 0.9 * flicker
  ctx.fillStyle = s.palette[Math.min(SHADES - 1, Math.floor(k * SHADES))]
  ctx.fillRect(e.x - e.size / 2, e.y - e.size / 2, e.size, e.size)
}

export const fireScene: Scene<FireState> = {
  init(w: number, h: number, p: EffectParams, rand: Rand): FireState {
    const color = hexRgb(p.color)
    const nt = countFor(9, p.density, 18)
    const ns = Math.min(FIRE_MAX - nt, countFor(45, p.density, 140))
    return {
      w,
      h,
      t: 0,
      tongues: Array.from({ length: nt }, (_, i) => newTongue(i, nt, w, h, rand)),
      sparks: Array.from({ length: ns }, () => newSpark(w, h, rand)),
      palette: sparkPalette(color),
      outer: [
        rgba(mix(YELLOW, color, 0.3), 0.45),
        rgba(color, 0.34),
        rgba(mix(color, DARK, 0.6), 0.22),
        rgba(DARK, 0)
      ],
      core: [rgba(HOT, 0.75), rgba(YELLOW, 0.45), rgba(mix(YELLOW, color, 0.5), 0)]
    }
  },
  step(s: FireState, dt: number, rand: Rand): void {
    s.t = (s.t + dt) % 1000
    for (const e of s.sparks) stepSpark(e, s, dt, rand)
  },
  draw(ctx: Ctx, s: FireState): void {
    ctx.globalCompositeOperation = 'lighter'
    drawTongues(ctx, s, s.outer, 1)
    drawTongues(ctx, s, s.core, 0.5)
    for (const e of s.sparks) drawSpark(ctx, s, e)
  }
}
