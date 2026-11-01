// Synthwave: grade em perspectiva no terço de baixo andando em direção a quem
// olha, linha do horizonte acesa e um sol listrado atrás (bem translúcido).
import type { Ctx, EffectParams, Scene } from './types'
import { clamp, hexRgb, mix, rgba, TAU, WHITE } from './util'

export interface SynthwaveState {
  w: number
  h: number
  /** Avanço da grade em [0, 1): uma linha horizontal inteira por ciclo. */
  offset: number
  horizon: number
  rows: number
  /** Linhas verticais para cada lado do centro. */
  half: number
  line: string
  glow: string
  sunTop: string
  sunBottom: string
}

/** Linhas horizontais por segundo (antes da velocidade do tema). */
const ROWS_PER_S = 0.5

/** y da linha horizontal i (0 = no horizonte); as de perto ficam mais espaçadas. */
export function rowY(s: SynthwaveState, i: number): number {
  const z = (i + s.offset) / s.rows
  return s.horizon + (s.h - s.horizon) * z * z
}

function drawSun(ctx: Ctx, s: SynthwaveState): void {
  const r = s.w * 0.22
  const cy = s.horizon - r * 0.35
  const g = ctx.createLinearGradient(0, cy - r, 0, cy + r)
  g.addColorStop(0, s.sunTop)
  g.addColorStop(1, s.sunBottom)
  ctx.globalAlpha = 0.38
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(s.w / 2, cy, r, 0, TAU)
  ctx.fill()
  // Listras e o corte no horizonte: apaga só o sol (o canvas está limpo).
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = '#000'
  for (let i = 0; i < 5; i++) ctx.fillRect(0, cy + i * r * 0.16, s.w, 1.5 + i * 1.2)
  ctx.fillRect(0, s.horizon, s.w, s.h - s.horizon)
}

function drawHorizon(ctx: Ctx, s: SynthwaveState): void {
  const g = ctx.createLinearGradient(0, s.horizon - 18, 0, s.horizon + 18)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(0.5, s.glow)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, s.horizon - 18, s.w, 36)
  ctx.globalAlpha = 0.9
  ctx.strokeStyle = s.line
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(0, s.horizon)
  ctx.lineTo(s.w, s.horizon)
  ctx.stroke()
}

function drawRows(ctx: Ctx, s: SynthwaveState): void {
  ctx.lineWidth = 1
  for (let i = 0; i < s.rows; i++) {
    const y = rowY(s, i)
    ctx.globalAlpha = 0.75 * ((i + s.offset) / s.rows)
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(s.w, y)
    ctx.stroke()
  }
}

function drawColumns(ctx: Ctx, s: SynthwaveState): void {
  const cx = s.w / 2
  const gap = s.w / s.half / 1.2
  ctx.globalAlpha = 0.48
  ctx.beginPath()
  for (let j = -s.half; j <= s.half; j++) {
    ctx.moveTo(cx + j * gap * 0.08, s.horizon)
    ctx.lineTo(cx + j * gap, s.h)
  }
  ctx.stroke()
}

export const synthwaveScene: Scene<SynthwaveState> = {
  init(w: number, h: number, p: EffectParams): SynthwaveState {
    const color = hexRgb(p.color)
    const d = Number.isFinite(p.density) ? p.density : 1
    return {
      w,
      h,
      offset: 0,
      horizon: h * 0.68,
      rows: clamp(Math.round(8 * d), 4, 16),
      half: clamp(Math.round(6 * d), 3, 12),
      line: rgba(color, 1),
      glow: rgba(color, 0.45),
      sunTop: rgba(mix([255, 214, 107], WHITE, 0.2), 1),
      sunBottom: rgba(color, 1)
    }
  },
  step(s: SynthwaveState, dt: number): void {
    s.offset = (s.offset + dt * ROWS_PER_S) % 1
  },
  draw(ctx: Ctx, s: SynthwaveState): void {
    drawSun(ctx, s)
    ctx.globalCompositeOperation = 'lighter'
    drawHorizon(ctx, s)
    drawRows(ctx, s)
    drawColumns(ctx, s)
  }
}
