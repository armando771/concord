// Aurora boreal: 2–3 cortinas onduladas no terço de cima, cada uma com
// degradê vertical para transparente, se mexendo devagar. A matiz parte da
// cor do tema e varia um pouco entre as faixas e com o tempo.
import type { Ctx, EffectParams, Rand, Scene } from './types'
import { between, clamp, hexRgb, hsl, TAU } from './util'

/** Passo horizontal das curvas, em px. */
const STEP_X = 15

export interface Band {
  base: number
  amp: number
  freq: number
  phase: number
  speed: number
  height: number
  hue: number
}

export interface AuroraState {
  w: number
  h: number
  t: number
  bands: Band[]
  hue: number
  sat: number
  light: number
}

function newBand(i: number, h: number, rand: Rand): Band {
  return {
    base: h * between(rand, 0.06, 0.2) + i * h * 0.04,
    amp: between(rand, 8, 18),
    freq: between(rand, 0.012, 0.022),
    phase: rand() * TAU,
    speed: between(rand, 0.25, 0.5) * (i % 2 ? -1 : 1),
    height: h * between(rand, 0.12, 0.2),
    hue: (i - 1) * 18 + between(rand, -6, 6)
  }
}

/** Altura da borda de cima da faixa no x dado. */
export function edgeY(b: Band, x: number): number {
  return (
    b.base +
    Math.sin(x * b.freq + b.phase) * b.amp +
    Math.sin(x * b.freq * 2.3 - b.phase * 0.7 + 1) * b.amp * 0.45
  )
}

function color(s: AuroraState, hue: number, alpha: number): string {
  return `hsla(${hue.toFixed(1)},${s.sat.toFixed(0)}%,${s.light.toFixed(0)}%,${alpha})`
}

function traceBand(ctx: Ctx, s: AuroraState, b: Band): void {
  ctx.beginPath()
  ctx.moveTo(0, edgeY(b, 0))
  for (let x = STEP_X; x < s.w + STEP_X; x += STEP_X) ctx.lineTo(x, edgeY(b, x))
  for (let x = s.w + STEP_X; x >= 0; x -= STEP_X) {
    ctx.lineTo(x, edgeY(b, x) + b.height * (0.8 + 0.2 * Math.sin(x * 0.02 + b.phase)))
  }
  ctx.closePath()
}

function drawBand(ctx: Ctx, s: AuroraState, b: Band, i: number): void {
  const hue = s.hue + b.hue + Math.sin(s.t * 0.3 + i) * 8
  const g = ctx.createLinearGradient(0, b.base - b.amp * 1.5, 0, b.base + b.height + b.amp)
  g.addColorStop(0, color(s, hue, 0))
  g.addColorStop(0.25, color(s, hue, 0.28))
  g.addColorStop(1, color(s, hue, 0))
  ctx.fillStyle = g
  traceBand(ctx, s, b)
  ctx.fill()
}

export const auroraScene: Scene<AuroraState> = {
  init(w: number, h: number, p: EffectParams, rand: Rand): AuroraState {
    const [hue, sat, light] = hsl(hexRgb(p.color))
    const n = p.density < 0.8 ? 2 : 3
    return {
      w,
      h,
      t: 0,
      bands: Array.from({ length: n }, (_, i) => newBand(i, h, rand)),
      hue,
      sat: Math.max(sat, 55),
      light: clamp(light, 45, 70)
    }
  },
  step(s: AuroraState, dt: number): void {
    s.t = (s.t + dt) % 1000
    for (const b of s.bands) b.phase = (b.phase + b.speed * dt) % TAU
  },
  draw(ctx: Ctx, s: AuroraState): void {
    ctx.globalCompositeOperation = 'lighter'
    s.bands.forEach((b, i) => drawBand(ctx, s, b, i))
  }
}
