// Chuva: gotas inclinadas caindo e respingos pequenos quando chegam na base.
import type { Ctx, EffectParams, Rand, Scene } from './types'
import { between, countFor, hexRgb, rgba, TAU } from './util'

/** Inclinação: px para o lado a cada px de queda. */
const SLANT = 0.25

export interface RainDrop {
  x: number
  y: number
  len: number
  v: number
  /** Onde esta gota bate (perto da base do cartão). */
  floor: number
}

export interface Splash {
  x: number
  y: number
  life: number
  max: number
  r: number
}

export interface RainState {
  w: number
  h: number
  drops: RainDrop[]
  splashes: Splash[]
  /** Próximo respingo do anel a ser reaproveitado. */
  next: number
  drop: string
  splash: string
}

function spawnDrop(d: RainDrop, s: { w: number; h: number }, rand: Rand, top: boolean): void {
  d.len = between(rand, 10, 20)
  d.v = between(rand, 380, 560)
  d.floor = s.h - between(rand, 0, 10)
  d.y = top ? -d.len - rand() * s.h * 0.3 : rand() * s.h
  // Começa mais à esquerda para a inclinação não deixar um canto seco.
  d.x = between(rand, -SLANT * s.h, s.w)
}

function splashAt(s: RainState, x: number, y: number, rand: Rand): void {
  const sp = s.splashes[s.next]
  s.next = (s.next + 1) % s.splashes.length
  sp.x = x
  sp.y = y
  sp.life = 0
  sp.max = between(rand, 0.18, 0.32)
  sp.r = between(rand, 3, 6)
}

function stepDrop(d: RainDrop, s: RainState, dt: number, rand: Rand): void {
  d.y += d.v * dt
  d.x += d.v * SLANT * dt
  if (d.y < d.floor) return
  splashAt(s, d.x, d.floor, rand)
  spawnDrop(d, s, rand, true)
}

function drawSplash(ctx: Ctx, sp: Splash): void {
  if (sp.life >= sp.max) return
  const k = sp.life / sp.max
  ctx.globalAlpha = (1 - k) * 0.65
  ctx.beginPath()
  ctx.ellipse(sp.x, sp.y, sp.r * (0.4 + k), sp.r * (0.4 + k) * 0.35, 0, 0, TAU)
  ctx.stroke()
}

export const rainScene: Scene<RainState> = {
  init(w: number, h: number, p: EffectParams, rand: Rand): RainState {
    const color = hexRgb(p.color)
    const drops = Array.from({ length: countFor(80, p.density, 120) }, () => {
      const d: RainDrop = { x: 0, y: 0, len: 0, v: 0, floor: h }
      spawnDrop(d, { w, h }, rand, false)
      return d
    })
    const splashes = Array.from({ length: countFor(20, p.density, 40) }, () => ({
      x: 0,
      y: 0,
      life: 1,
      max: 1,
      r: 0
    }))
    return { w, h, drops, splashes, next: 0, drop: rgba(color, 0.5), splash: rgba(color, 1) }
  },
  step(s: RainState, dt: number, rand: Rand): void {
    for (const sp of s.splashes) sp.life = Math.min(sp.max, sp.life + dt)
    for (const d of s.drops) stepDrop(d, s, dt, rand)
  },
  draw(ctx: Ctx, s: RainState): void {
    ctx.strokeStyle = s.drop
    ctx.lineWidth = 1.2
    ctx.beginPath()
    for (const d of s.drops) {
      ctx.moveTo(d.x, d.y)
      ctx.lineTo(d.x - d.len * SLANT, d.y - d.len)
    }
    ctx.stroke()
    ctx.strokeStyle = s.splash
    for (const sp of s.splashes) drawSplash(ctx, sp)
  }
}
