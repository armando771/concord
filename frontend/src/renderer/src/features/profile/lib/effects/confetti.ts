// Confete: fitinhas multicoloridas caindo, girando e "virando" (escala no
// eixo), com um vento leve que vai e volta. Paleta própria (ignora a cor).
import type { Ctx, EffectParams, Rand, Scene } from './types'
import { between, countFor, TAU } from './util'

export const CONFETTI_COLORS = ['#ff5e7e', '#ffd166', '#06d6a0', '#4cc9f0', '#b388ff', '#ff9f1c']
/** Margem fora do cartão antes de reciclar/dar a volta, em px. */
const EDGE = 12

export interface Piece {
  x: number
  y: number
  vx: number
  vy: number
  w: number
  h: number
  rot: number
  vr: number
  flip: number
  vf: number
  color: number
}

export interface ConfettiState {
  w: number
  h: number
  t: number
  pieces: Piece[]
}

function spawn(c: Piece, s: { w: number; h: number }, rand: Rand, top: boolean): void {
  c.x = rand() * s.w
  c.y = top ? -between(rand, 6, 40) : rand() * s.h
  c.vx = between(rand, -15, 15)
  c.vy = between(rand, 40, 85)
  c.w = between(rand, 3, 6)
  c.h = between(rand, 7, 13)
  c.rot = rand() * TAU
  c.vr = between(rand, -3, 3)
  c.flip = rand() * TAU
  c.vf = between(rand, 3, 8)
  c.color = Math.floor(rand() * CONFETTI_COLORS.length)
}

/** O vento leva para os lados: quem sai de um lado volta pelo outro. */
function wrapX(c: Piece, w: number): void {
  if (c.x < -EDGE) c.x += w + EDGE * 2
  else if (c.x > w + EDGE) c.x -= w + EDGE * 2
}

function stepPiece(c: Piece, s: ConfettiState, dt: number, wind: number, rand: Rand): void {
  c.x += (c.vx + wind) * dt
  c.y += c.vy * dt
  c.rot = (c.rot + c.vr * dt) % TAU
  c.flip = (c.flip + c.vf * dt) % TAU
  wrapX(c, s.w)
  if (c.y > s.h + EDGE) spawn(c, s, rand, true)
}

function drawPiece(ctx: Ctx, c: Piece): void {
  const face = Math.cos(c.flip)
  ctx.globalAlpha = 0.5 + 0.3 * Math.abs(face)
  ctx.fillStyle = CONFETTI_COLORS[c.color]
  ctx.save()
  ctx.translate(c.x, c.y)
  ctx.rotate(c.rot)
  ctx.scale(1, face)
  ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h)
  ctx.restore()
}

function newPiece(s: { w: number; h: number }, rand: Rand): Piece {
  const c: Piece = { x: 0, y: 0, vx: 0, vy: 0, w: 0, h: 0, rot: 0, vr: 0, flip: 0, vf: 0, color: 0 }
  spawn(c, s, rand, false)
  return c
}

export const confettiScene: Scene<ConfettiState> = {
  init(w: number, h: number, p: EffectParams, rand: Rand): ConfettiState {
    const n = countFor(60, p.density, 160)
    return { w, h, t: 0, pieces: Array.from({ length: n }, () => newPiece({ w, h }, rand)) }
  },
  step(s: ConfettiState, dt: number, rand: Rand): void {
    s.t = (s.t + dt) % 1000
    const wind = Math.sin(s.t * 0.6) * 18
    for (const c of s.pieces) stepPiece(c, s, dt, wind, rand)
  },
  draw(ctx: Ctx, s: ConfettiState): void {
    for (const c of s.pieces) drawPiece(ctx, c)
  }
}
