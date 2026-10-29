// Corações: sobem de baixo balançando e girando um pouco, e somem no topo.
import type { Ctx, EffectParams, Rand, Scene } from './types'
import { between, clamp, countFor, hexRgb, mix, rgba, TAU, WHITE } from './util'

/** Giro máximo para cada lado, em radianos. */
const MAX_ROT = 0.45
/** Velocidade do pulso, em rad/s (~1 batida por segundo). */
const PULSE_SPEED = 6

export interface Heart {
  x: number
  y: number
  vy: number
  swayAmp: number
  swayFreq: number
  phase: number
  size: number
  rot: number
  vr: number
  tint: number
  /** Fase do pulso de escala (batida). */
  pulse: number
}

export interface HeartsState {
  w: number
  h: number
  hearts: Heart[]
  tints: string[]
}

function spawn(c: Heart, s: { w: number; h: number }, rand: Rand, below: boolean): void {
  c.x = between(rand, 0.05, 0.95) * s.w
  c.y = below ? s.h + between(rand, 5, s.h * 0.15) : rand() * s.h
  c.vy = between(rand, 25, 55)
  c.swayAmp = between(rand, 6, 16)
  c.swayFreq = between(rand, 1, 2.2)
  c.phase = rand() * TAU
  c.size = between(rand, 8, 22)
  c.rot = between(rand, -0.3, 0.3)
  c.vr = between(rand, -0.6, 0.6)
  c.tint = Math.floor(rand() * 2)
  c.pulse = rand() * TAU
}

function stepHeart(c: Heart, s: HeartsState, dt: number, rand: Rand): void {
  c.y -= c.vy * dt
  c.phase = (c.phase + c.swayFreq * dt) % TAU
  c.pulse = (c.pulse + PULSE_SPEED * dt) % TAU
  c.rot += c.vr * dt
  if (Math.abs(c.rot) > MAX_ROT) c.vr = -c.vr
  c.rot = clamp(c.rot, -MAX_ROT, MAX_ROT)
  if (c.y < -c.size * 2) spawn(c, s, rand, true)
}

/** Coração de lado 1 centrado na origem (a ponta para baixo). */
function traceHeart(ctx: Ctx): void {
  ctx.beginPath()
  ctx.moveTo(0, 0.35)
  ctx.bezierCurveTo(-0.1, 0.25, -0.5, 0.05, -0.5, -0.2)
  ctx.bezierCurveTo(-0.5, -0.45, -0.15, -0.55, 0, -0.3)
  ctx.bezierCurveTo(0.15, -0.55, 0.5, -0.45, 0.5, -0.2)
  ctx.bezierCurveTo(0.5, 0.05, 0.1, 0.25, 0, 0.35)
  ctx.closePath()
}

/** Some no quinto de cima e aparece rápido na base. */
export function heartAlpha(c: Heart, h: number): number {
  const top = clamp((c.y + c.size) / (h * 0.2), 0, 1)
  const bottom = clamp((h - c.y) / 25, 0, 1)
  return 0.8 * Math.min(top, bottom)
}

function drawHeart(ctx: Ctx, s: HeartsState, c: Heart): void {
  ctx.globalAlpha = heartAlpha(c, s.h)
  ctx.fillStyle = s.tints[c.tint]
  ctx.save()
  ctx.translate(c.x + Math.sin(c.phase) * c.swayAmp, c.y)
  ctx.rotate(c.rot)
  const size = c.size * (1 + 0.1 * Math.sin(c.pulse))
  ctx.scale(size, size)
  traceHeart(ctx)
  ctx.fill()
  ctx.restore()
}

export const heartsScene: Scene<HeartsState> = {
  init(w: number, h: number, p: EffectParams, rand: Rand): HeartsState {
    const color = hexRgb(p.color)
    const n = countFor(16, p.density, 48)
    const hearts = Array.from({ length: n }, () => {
      const c: Heart = {
        x: 0,
        y: 0,
        vy: 0,
        swayAmp: 0,
        swayFreq: 0,
        phase: 0,
        size: 0,
        rot: 0,
        vr: 0,
        tint: 0,
        pulse: 0
      }
      spawn(c, { w, h }, rand, false)
      return c
    })
    return { w, h, hearts, tints: [rgba(color, 1), rgba(mix(color, WHITE, 0.35), 1)] }
  },
  step(s: HeartsState, dt: number, rand: Rand): void {
    for (const c of s.hearts) stepHeart(c, s, dt, rand)
  },
  draw(ctx: Ctx, s: HeartsState): void {
    for (const c of s.hearts) drawHeart(ctx, s, c)
  }
}
