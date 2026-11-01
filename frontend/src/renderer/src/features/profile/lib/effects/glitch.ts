// Glitch: quase nada na maior parte do tempo (só scanlines bem sutis) e, a
// cada 1,5–3 s, uma rajada de 150–400 ms: fatias com RGB split forte
// (ciano/magenta), um "rasgo" horizontal deslocado e blocos de ruído. Não usa
// a cor do tema.
import type { Ctx, EffectParams, Rand, Scene } from './types'
import { between, countFor } from './util'

export interface Slice {
  y: number
  h: number
  dx: number
}

export interface Block {
  x: number
  y: number
  w: number
  h: number
  a: number
  color: number
}

export interface GlitchState {
  w: number
  h: number
  /** Segundos até a próxima rajada. */
  wait: number
  /** Segundos que faltam da rajada atual (0 = parado). */
  burst: number
  /** Segundos até sortear de novo as fatias da rajada. */
  reroll: number
  active: number
  slices: Slice[]
  blocks: Block[]
  /** Faixa larga "rasgada" e deslocada para o lado. */
  tear: Slice
}

const REROLL = 0.05
const SCANLINE_GAP = 3
const BLOCK_COLORS = ['#ffffff', '#000000', '#00ffff', '#ff00ff']
const CYAN = 'rgba(0,255,255,0.32)'
const MAGENTA = 'rgba(255,0,255,0.32)'

function rerollSlice(sl: Slice, s: GlitchState, rand: Rand): void {
  sl.y = rand() * s.h
  sl.h = between(rand, 2, 20)
  sl.dx = between(rand, -24, 24)
}

function rerollBlock(b: Block, s: GlitchState, rand: Rand): void {
  b.x = rand() * s.w
  b.y = rand() * s.h
  b.w = between(rand, 8, 70)
  b.h = between(rand, 2, 10)
  b.a = between(rand, 0.15, 0.4)
  b.color = Math.floor(rand() * BLOCK_COLORS.length)
}

function rerollTear(t: Slice, s: GlitchState, rand: Rand): void {
  t.y = between(rand, 0.1, 0.85) * s.h
  t.h = between(rand, 18, 56)
  t.dx = between(rand, 10, 34) * (rand() < 0.5 ? -1 : 1)
}

function reroll(s: GlitchState, rand: Rand): void {
  for (const sl of s.slices) rerollSlice(sl, s, rand)
  for (const b of s.blocks) rerollBlock(b, s, rand)
  rerollTear(s.tear, s, rand)
  s.active = Math.ceil(between(rand, 0.4, 1) * s.slices.length)
  s.reroll = REROLL
}

function stepBurst(s: GlitchState, dt: number, rand: Rand): void {
  s.burst = Math.max(0, s.burst - dt)
  s.reroll -= dt
  if (s.reroll <= 0) reroll(s, rand)
}

function stepIdle(s: GlitchState, dt: number, rand: Rand): void {
  s.wait -= dt
  if (s.wait > 0) return
  s.burst = between(rand, 0.15, 0.4)
  s.wait = between(rand, 1.5, 3)
  reroll(s, rand)
}

function drawScanlines(ctx: Ctx, s: GlitchState): void {
  ctx.fillStyle = 'rgba(0,0,0,0.06)'
  for (let y = 0; y < s.h; y += SCANLINE_GAP) ctx.fillRect(0, y, s.w, 1)
}

/** Duas cópias da fatia, uma para cada lado: o "RGB split". */
function drawSplit(ctx: Ctx, s: GlitchState, sl: Slice): void {
  ctx.fillStyle = CYAN
  ctx.fillRect(sl.dx, sl.y, s.w, sl.h)
  ctx.fillStyle = MAGENTA
  ctx.fillRect(-sl.dx, sl.y + 1, s.w, sl.h)
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.fillRect(0, sl.y, s.w, 1)
}

/** Rasgo: a faixa clara deslocada, o buraco escuro que ela deixa e bordas coloridas. */
function drawTear(ctx: Ctx, s: GlitchState): void {
  const t = s.tear
  ctx.fillStyle = 'rgba(255,255,255,0.14)'
  ctx.fillRect(t.dx, t.y, s.w, t.h)
  ctx.fillStyle = 'rgba(0,0,0,0.55)'
  ctx.fillRect(t.dx > 0 ? 0 : s.w + t.dx, t.y, Math.abs(t.dx), t.h)
  ctx.fillStyle = CYAN
  ctx.fillRect(t.dx, t.y - 2, s.w, 2)
  ctx.fillStyle = MAGENTA
  ctx.fillRect(-t.dx, t.y + t.h, s.w, 2)
}

function drawBlocks(ctx: Ctx, s: GlitchState): void {
  for (const b of s.blocks) {
    ctx.globalAlpha = b.a
    ctx.fillStyle = BLOCK_COLORS[b.color]
    ctx.fillRect(b.x, b.y, b.w, b.h)
  }
  ctx.globalAlpha = 1
}

function drawBurst(ctx: Ctx, s: GlitchState): void {
  drawTear(ctx, s)
  for (let i = 0; i < s.active; i++) drawSplit(ctx, s, s.slices[i])
  drawBlocks(ctx, s)
}

export const glitchScene: Scene<GlitchState> = {
  init(w: number, h: number, p: EffectParams, rand: Rand): GlitchState {
    const s: GlitchState = {
      w,
      h,
      wait: between(rand, 0.4, 1.5),
      burst: 0,
      reroll: 0,
      active: 0,
      slices: Array.from({ length: countFor(7, p.density, 16) }, () => ({ y: 0, h: 0, dx: 0 })),
      blocks: Array.from({ length: countFor(12, p.density, 30) }, () => ({
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        a: 0,
        color: 0
      })),
      tear: { y: 0, h: 0, dx: 0 }
    }
    reroll(s, rand)
    s.active = 0
    return s
  },
  step(s: GlitchState, dt: number, rand: Rand): void {
    if (s.burst > 0) stepBurst(s, dt, rand)
    else stepIdle(s, dt, rand)
  },
  draw(ctx: Ctx, s: GlitchState): void {
    drawScanlines(ctx, s)
    if (s.burst > 0) drawBurst(ctx, s)
  }
}
