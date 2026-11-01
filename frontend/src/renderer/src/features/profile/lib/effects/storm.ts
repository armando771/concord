// Tempestade: de tempos em tempos um relâmpago ramificado (segmentos com
// tremor e galhos) com um clarão que decai rápido, e uma garoa leve.
import type { Ctx, EffectParams, Rand, Scene } from './types'
import { between, countFor, hexRgb, mix, rgba, WHITE } from './util'

/** Máximo de segmentos de um raio (tronco + galhos). */
export const STORM_SEGS = 120
/** Floats por segmento: x1, y1, x2, y2, tronco (1) ou galho (0). */
const SEG = 5
/** Clarão: opacidade no pico e quanto cai por segundo (some em ~0,25 s). */
export const FLASH_ALPHA = 0.35
const FLASH_DECAY = 4

export interface Drizzle {
  x: number
  y: number
  len: number
  v: number
}

export interface StormState {
  w: number
  h: number
  t: number
  wait: number
  life: number
  maxLife: number
  flash: number
  segs: Float32Array
  count: number
  drops: Drizzle[]
  core: string
  glow: string
  flashColor: string
}

function push(s: StormState, x1: number, y1: number, x2: number, y2: number, main: number): void {
  if (s.count >= STORM_SEGS) return
  const o = s.count * SEG
  s.segs[o] = x1
  s.segs[o + 1] = y1
  s.segs[o + 2] = x2
  s.segs[o + 3] = y2
  s.segs[o + 4] = main
  s.count++
}

function fork(s: StormState, x: number, y: number, rand: Rand): void {
  const dir = rand() < 0.5 ? -1 : 1
  const n = Math.floor(between(rand, 2, 5))
  for (let i = 0; i < n; i++) {
    const nx = x + dir * between(rand, 6, 22)
    const ny = y + between(rand, 8, 22)
    push(s, x, y, nx, ny, 0)
    x = nx
    y = ny
  }
}

/** Gera o raio: um tronco que desce tremendo e solta galhos pelo caminho. */
export function buildBolt(s: StormState, rand: Rand): void {
  s.count = 0
  let x = s.w * between(rand, 0.2, 0.8)
  let y = 0
  const end = s.h * between(rand, 0.55, 0.9)
  const stepY = s.h / 16
  while (y < end) {
    const nx = x + between(rand, -18, 18)
    const ny = y + stepY * between(rand, 0.6, 1.2)
    push(s, x, y, nx, ny, 1)
    if (rand() < 0.3) fork(s, nx, ny, rand)
    x = nx
    y = ny
  }
}

function strike(s: StormState, rand: Rand): void {
  buildBolt(s, rand)
  s.maxLife = between(rand, 0.18, 0.35)
  s.life = s.maxLife
  s.flash = 1
  s.wait = between(rand, 1.5, 4)
}

function stepBolt(s: StormState, dt: number, rand: Rand): void {
  s.flash = Math.max(0, s.flash - dt * FLASH_DECAY)
  if (s.life > 0) {
    s.life = Math.max(0, s.life - dt)
    return
  }
  s.wait -= dt
  if (s.wait <= 0) strike(s, rand)
}

function stepDrop(d: Drizzle, s: StormState, dt: number, rand: Rand): void {
  d.y += d.v * dt
  d.x += d.v * 0.15 * dt
  if (d.y <= s.h) return
  d.y = -d.len - rand() * 20
  d.x = between(rand, -0.1, 1) * s.w
}

function newDrop(s: { w: number; h: number }, rand: Rand): Drizzle {
  return {
    x: between(rand, -0.1, 1) * s.w,
    y: rand() * s.h,
    len: between(rand, 6, 12),
    v: between(rand, 260, 380)
  }
}

function tracePath(ctx: Ctx, s: StormState, main: number): void {
  ctx.beginPath()
  for (let i = 0; i < s.count; i++) {
    const o = i * SEG
    if (s.segs[o + 4] !== main) continue
    ctx.moveTo(s.segs[o], s.segs[o + 1])
    ctx.lineTo(s.segs[o + 2], s.segs[o + 3])
  }
}

function drawBolt(ctx: Ctx, s: StormState): void {
  const k = s.life / s.maxLife
  const flicker = Math.sin(s.t * 70) > -0.2 ? 1 : 0.45
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  tracePath(ctx, s, 1)
  // Duas passadas: larga e translúcida (brilho) e fina e clara (núcleo).
  ctx.strokeStyle = s.glow
  ctx.globalAlpha = 0.45 * k * flicker
  ctx.lineWidth = 8
  ctx.stroke()
  ctx.strokeStyle = s.core
  ctx.globalAlpha = k * flicker
  ctx.lineWidth = 2
  ctx.stroke()
  tracePath(ctx, s, 0)
  ctx.strokeStyle = s.glow
  ctx.globalAlpha = 0.35 * k * flicker
  ctx.lineWidth = 4
  ctx.stroke()
  ctx.strokeStyle = s.core
  ctx.globalAlpha = 0.75 * k * flicker
  ctx.lineWidth = 1
  ctx.stroke()
}

function drawDrizzle(ctx: Ctx, s: StormState): void {
  ctx.strokeStyle = 'rgba(200,215,235,0.18)'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (const d of s.drops) {
    ctx.moveTo(d.x, d.y)
    ctx.lineTo(d.x - d.len * 0.15, d.y - d.len)
  }
  ctx.stroke()
}

export const stormScene: Scene<StormState> = {
  init(w: number, h: number, p: EffectParams, rand: Rand): StormState {
    const color = hexRgb(p.color)
    const n = countFor(35, p.density, 100)
    return {
      w,
      h,
      t: 0,
      wait: between(rand, 0.4, 1.5),
      life: 0,
      maxLife: 1,
      flash: 0,
      segs: new Float32Array(STORM_SEGS * SEG),
      count: 0,
      drops: Array.from({ length: n }, () => newDrop({ w, h }, rand)),
      core: rgba(mix(color, WHITE, 0.65), 1),
      glow: rgba(color, 1),
      flashColor: rgba(mix(color, WHITE, 0.8), 1)
    }
  },
  step(s: StormState, dt: number, rand: Rand): void {
    s.t += dt
    stepBolt(s, dt, rand)
    for (const d of s.drops) stepDrop(d, s, dt, rand)
  },
  draw(ctx: Ctx, s: StormState): void {
    if (s.flash > 0) {
      ctx.globalAlpha = s.flash * FLASH_ALPHA
      ctx.fillStyle = s.flashColor
      ctx.fillRect(0, 0, s.w, s.h)
      ctx.globalAlpha = 1
    }
    drawDrizzle(ctx, s)
    if (s.life > 0) drawBolt(ctx, s)
  }
}
