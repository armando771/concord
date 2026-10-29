// Matrix: chuva de caracteres (katakana meia-largura + dígitos) em colunas,
// com a cabeça clara e o rastro desbotando na cor do efeito.
import type { Ctx, EffectParams, Rand, Scene } from './types'
import { between, clamp, hexRgb, mix, mod, rgba, WHITE } from './util'

/** Tamanho da letra e largura da coluna, em px. */
export const MATRIX_FS = 14
/** Comprimento máximo do rastro (tamanho do anel de letras de cada gota). */
export const MATRIX_TRAIL = 20
const MAX_DROPS = 60

const GLYPHS: string[] = [
  ...Array.from({ length: 0xff9d - 0xff66 + 1 }, (_, i) => String.fromCharCode(0xff66 + i)),
  ...'0123456789'
]

export interface Drop {
  col: number
  y: number
  speed: number
  len: number
  cell: number
  glyphs: number[]
}

export interface MatrixState {
  w: number
  h: number
  cols: number
  offsetX: number
  drops: Drop[]
  head: string
  trail: string
}

function glyph(rand: Rand): number {
  return Math.floor(rand() * GLYPHS.length)
}

function spawn(d: Drop, s: MatrixState, rand: Rand, top: boolean): void {
  d.col = Math.floor(rand() * s.cols)
  d.speed = between(rand, 60, 160)
  d.len = Math.floor(between(rand, 6, 18))
  d.y = top ? -rand() * s.h * 0.5 : rand() * s.h
  d.cell = Math.floor(d.y / MATRIX_FS)
  for (let i = 0; i < MATRIX_TRAIL; i++) d.glyphs[i] = glyph(rand)
}

/** Cada célula nova que a cabeça alcança ganha uma letra sorteada. */
function advance(d: Drop, cell: number, rand: Rand): void {
  for (let c = Math.max(d.cell, cell - MATRIX_TRAIL); c < cell; c++) {
    d.glyphs[mod(c + 1, MATRIX_TRAIL)] = glyph(rand)
  }
  d.cell = cell
}

function stepDrop(d: Drop, s: MatrixState, dt: number, rand: Rand): void {
  d.y += d.speed * dt
  advance(d, Math.floor(d.y / MATRIX_FS), rand)
  if (d.y - d.len * MATRIX_FS > s.h) spawn(d, s, rand, true)
}

function drawCell(ctx: Ctx, s: MatrixState, d: Drop, cell: number): void {
  const y = cell * MATRIX_FS
  if (y < -MATRIX_FS || y > s.h) return
  ctx.fillText(GLYPHS[d.glyphs[mod(cell, MATRIX_TRAIL)]], s.offsetX + d.col * MATRIX_FS, y)
}

function drawDrop(ctx: Ctx, s: MatrixState, d: Drop): void {
  ctx.fillStyle = s.trail
  for (let k = 1; k < d.len; k++) {
    ctx.globalAlpha = 0.5 * (1 - k / d.len)
    drawCell(ctx, s, d, d.cell - k)
  }
  ctx.fillStyle = s.head
  ctx.globalAlpha = 0.85
  drawCell(ctx, s, d, d.cell)
}

export const matrixScene: Scene<MatrixState> = {
  init(w: number, h: number, p: EffectParams, rand: Rand): MatrixState {
    const color = hexRgb(p.color)
    const cols = Math.max(1, Math.floor(w / MATRIX_FS))
    const n = clamp(Math.round(cols * 0.75 * (p.density || 1)), 1, Math.min(cols * 2, MAX_DROPS))
    const s: MatrixState = {
      w,
      h,
      cols,
      offsetX: (w - cols * MATRIX_FS) / 2,
      drops: [],
      head: rgba(mix(color, WHITE, 0.75), 1),
      trail: rgba(color, 1)
    }
    for (let i = 0; i < n; i++) {
      const d: Drop = { col: 0, y: 0, speed: 0, len: 0, cell: 0, glyphs: [] }
      spawn(d, s, rand, false)
      s.drops.push(d)
    }
    return s
  },
  step(s: MatrixState, dt: number, rand: Rand): void {
    for (const d of s.drops) stepDrop(d, s, dt, rand)
  },
  draw(ctx: Ctx, s: MatrixState): void {
    ctx.font = `${MATRIX_FS}px monospace`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    for (const d of s.drops) drawDrop(ctx, s, d)
  }
}
