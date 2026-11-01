// Galáxia / buraco negro: estrelas em órbita espiral em volta de um centro
// perto do topo, mais rápidas perto do núcleo, que vão caindo para dentro e
// renascem na borda. Disco brilhante na cor do tema e um núcleo escuro.
import type { Ctx, EffectParams, Rand, Scene } from './types'
import { between, countFor, hexRgb, mix, rgba, TAU, WHITE } from './util'

/** Achatamento do disco (visto meio de lado). */
const TILT = 0.42

export interface Star {
  r: number
  a: number
  size: number
  tint: number
  alpha: number
}

export interface GalaxyState {
  w: number
  h: number
  cx: number
  cy: number
  maxR: number
  coreR: number
  stars: Star[]
  tints: string[]
  disk: string
  ring: string
}

function spawn(st: Star, s: GalaxyState, rand: Rand, fresh: boolean): void {
  st.r = fresh ? between(rand, s.coreR * 1.3, s.maxR) : s.maxR * between(rand, 0.85, 1)
  // Dois braços: o ângulo inicial depende do raio (espiral).
  const arm = Math.floor(rand() * 2) * Math.PI
  st.a = arm + st.r * 0.035 + between(rand, -0.35, 0.35)
  st.size = between(rand, 0.8, 2.2)
  st.tint = Math.floor(rand() * 3)
  st.alpha = between(rand, 0.35, 0.9)
}

function stepStar(st: Star, s: GalaxyState, dt: number, rand: Rand): void {
  // Velocidade angular cai com o raio: rápido perto do núcleo.
  st.a = (st.a + (dt * 0.3 * (s.maxR + 8)) / (st.r + 8)) % TAU
  st.r -= dt * s.maxR * 0.03 * (1 + s.maxR / (st.r * 4))
  if (st.r < s.coreR) spawn(st, s, rand, false)
}

function drawDisk(ctx: Ctx, s: GalaxyState): void {
  ctx.save()
  ctx.translate(s.cx, s.cy)
  ctx.scale(1, TILT)
  const g = ctx.createRadialGradient(0, 0, s.coreR, 0, 0, s.maxR * 0.8)
  g.addColorStop(0, s.disk)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, s.maxR * 0.8, 0, TAU)
  ctx.fill()
  ctx.restore()
}

function drawStar(ctx: Ctx, s: GalaxyState, st: Star): void {
  const x = s.cx + Math.cos(st.a) * st.r
  const y = s.cy + Math.sin(st.a) * st.r * TILT
  ctx.globalAlpha = st.alpha
  ctx.fillStyle = s.tints[st.tint]
  ctx.fillRect(x - st.size / 2, y - st.size / 2, st.size, st.size)
}

function drawCore(ctx: Ctx, s: GalaxyState): void {
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
  const g = ctx.createRadialGradient(s.cx, s.cy, 0, s.cx, s.cy, s.coreR * 1.8)
  g.addColorStop(0, 'rgba(0,0,0,0.95)')
  g.addColorStop(0.55, 'rgba(0,0,0,0.85)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(s.cx, s.cy, s.coreR * 1.8, 0, TAU)
  ctx.fill()
  ctx.globalCompositeOperation = 'lighter'
  ctx.strokeStyle = s.ring
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.ellipse(s.cx, s.cy, s.coreR * 1.15, s.coreR * 0.95, 0, 0, TAU)
  ctx.stroke()
}

export const galaxyScene: Scene<GalaxyState> = {
  init(w: number, h: number, p: EffectParams, rand: Rand): GalaxyState {
    const color = hexRgb(p.color)
    const maxR = Math.max(20, Math.min(w * 0.5, h * 0.4))
    const s: GalaxyState = {
      w,
      h,
      cx: w * 0.7,
      cy: h * 0.17,
      maxR,
      coreR: maxR * 0.12,
      stars: [],
      tints: [rgba(WHITE, 1), rgba(mix(color, WHITE, 0.5), 1), rgba(color, 1)],
      disk: rgba(color, 0.3),
      ring: rgba(mix(color, WHITE, 0.6), 0.6)
    }
    const n = countFor(110, p.density, 160)
    for (let i = 0; i < n; i++) {
      const st: Star = { r: 0, a: 0, size: 1, tint: 0, alpha: 1 }
      spawn(st, s, rand, true)
      s.stars.push(st)
    }
    return s
  },
  step(s: GalaxyState, dt: number, rand: Rand): void {
    for (const st of s.stars) stepStar(st, s, dt, rand)
  },
  draw(ctx: Ctx, s: GalaxyState): void {
    ctx.globalCompositeOperation = 'lighter'
    drawDisk(ctx, s)
    for (const st of s.stars) drawStar(ctx, s, st)
    drawCore(ctx, s)
  }
}
