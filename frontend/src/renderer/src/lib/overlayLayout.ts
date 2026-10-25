// Posição e tamanho da lista do overlay de jogo. A janela do overlay cobre a
// área de trabalho inteira do monitor do jogo; a lista é uma caixa dentro
// dela. A posição é salva em fração da área (sobrevive a outra resolução ou
// outro monitor) e a caixa fica sempre inteira na tela. Auto-contido: o main
// e a página do overlay também usam.

/** Canto de cima à esquerda da caixa, em fração (0–1) da área de trabalho. */
export interface OverlayPoint {
  x: number
  y: number
}

export interface OverlayLayout {
  /** null = padrão: borda esquerda, no meio da altura. */
  position: OverlayPoint | null
  /** Tamanho da lista (letra/avatares); a largura acompanha. */
  scale: number
}

export interface OverlaySize {
  width: number
  height: number
}

/** Canto de cima à esquerda da caixa, em pixels (DIP = px do CSS). */
export interface OverlayBoxPx {
  left: number
  top: number
}

export const OVERLAY_SCALE_MIN = 0.7
export const OVERLAY_SCALE_MAX = 1.6
export const OVERLAY_SCALE_STEP = 0.05
export const OVERLAY_SCALE_DEFAULT = 1
/** Distância da borda esquerda na posição padrão. */
export const OVERLAY_EDGE_MARGIN = 8

export const OVERLAY_DEFAULT_LAYOUT: OverlayLayout = {
  position: null,
  scale: OVERLAY_SCALE_DEFAULT
}

const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const round4 = (value: number): number => Math.round(value * 10000) / 10000

/** Encaixa em 0,7×–1,6× em passos de 0,05; valor estragado volta a 1×. */
export function clampOverlayScale(value: number): number {
  if (!finite(value)) return OVERLAY_SCALE_DEFAULT
  const stepped = Math.round(value / OVERLAY_SCALE_STEP) * OVERLAY_SCALE_STEP
  return round4(Math.min(OVERLAY_SCALE_MAX, Math.max(OVERLAY_SCALE_MIN, stepped)))
}

export function fractionToPixels(point: OverlayPoint, area: OverlaySize): OverlayBoxPx {
  return { left: Math.round(point.x * area.width), top: Math.round(point.y * area.height) }
}

/** Pixels → fração (4 casas, 0–1). Área sem tamanho dá 0. */
export function pixelsToFraction(px: OverlayBoxPx, area: OverlaySize): OverlayPoint {
  const frac = (value: number, size: number): number =>
    size > 0 ? round4(Math.min(1, Math.max(0, value / size))) : 0
  return { x: frac(px.left, area.width), y: frac(px.top, area.height) }
}

/** A caixa inteira dentro da área; maior que ela, encosta em cima à esquerda. */
export function clampBoxToArea(
  px: OverlayBoxPx,
  area: OverlaySize,
  box: OverlaySize
): OverlayBoxPx {
  const clamp = (value: number, max: number): number =>
    Math.round(Math.max(0, Math.min(value, max)))
  return {
    left: clamp(px.left, area.width - box.width),
    top: clamp(px.top, area.height - box.height)
  }
}

/** Onde a caixa aparece: posição salva (ou a padrão), sempre inteira na tela. */
export function placeOverlayBox(
  position: OverlayPoint | null,
  area: OverlaySize,
  box: OverlaySize
): OverlayBoxPx {
  const px = position
    ? fractionToPixels(position, area)
    : { left: OVERLAY_EDGE_MARGIN, top: (area.height - box.height) / 2 }
  return clampBoxToArea(px, area, box)
}

/** Arrastar: posição de partida + deslocamento, encaixada e já em fração. */
export function moveOverlayBox(
  start: OverlayBoxPx,
  dx: number,
  dy: number,
  area: OverlaySize,
  box: OverlaySize
): OverlayPoint {
  return pixelsToFraction(
    clampBoxToArea({ left: start.left + dx, top: start.top + dy }, area, box),
    area
  )
}

/**
 * Puxar o canto de baixo à direita: a escala cresce na proporção em que a
 * caixa (largura + altura) cresceria.
 */
export function resizeOverlayScale(
  startScale: number,
  startBox: OverlaySize,
  dx: number,
  dy: number
): number {
  const size = startBox.width + startBox.height
  if (size <= 0) return clampOverlayScale(startScale)
  return clampOverlayScale((startScale * (size + dx + dy)) / size)
}

/** Valor salvo/recebido → layout válido (o que estiver estragado volta ao padrão). */
export function normalizeOverlayLayout(raw: unknown): OverlayLayout {
  if (!raw || typeof raw !== 'object') return OVERLAY_DEFAULT_LAYOUT
  const { position, scale } = raw as { position?: unknown; scale?: unknown }
  let point: OverlayPoint | null = null
  if (position && typeof position === 'object') {
    const { x, y } = position as { x?: unknown; y?: unknown }
    if (finite(x) && finite(y)) {
      point = { x: round4(Math.min(1, Math.max(0, x))), y: round4(Math.min(1, Math.max(0, y))) }
    }
  }
  return { position: point, scale: clampOverlayScale(scale as number) }
}

export function sameOverlayLayout(a: OverlayLayout, b: OverlayLayout): boolean {
  if (a.scale !== b.scale) return false
  if (a.position === null || b.position === null) return a.position === b.position
  return a.position.x === b.position.x && a.position.y === b.position.y
}

/**
 * Último arraste na página do overlay. Vale enquanto o salvo continuar o de
 * quando o arraste começou (renderer principal ainda salvando).
 */
export interface OverlayDraft {
  layout: OverlayLayout
  /** Layout salvo quando o arraste começou. */
  base: OverlayLayout
}

/** O que mostrar: o arraste, até o salvo mudar (chegou o novo, ou "Restaurar posição"). */
export function shownOverlayLayout(
  saved: OverlayLayout,
  draft: OverlayDraft | null
): OverlayLayout {
  return draft && sameOverlayLayout(saved, draft.base) ? draft.layout : saved
}
