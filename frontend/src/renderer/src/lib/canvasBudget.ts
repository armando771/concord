/** Teto de pixels do canvas dos marcos (~2 MP, ~8 MB RGBA). */
export const CANVAS_MAX_PIXELS = 2_000_000

/**
 * Escala do canvas em tela cheia dos marcos: segue o devicePixelRatio até
 * 1,5, mas limitada pela área (4K a 150% ficaria com 8 MP) e em 1× durante
 * uma call, que é quando os marcos tocam de verdade e a GPU já está ocupada
 * com o vídeo. São brilhos suaves: a resolução menor não aparece.
 */
export function canvasScale({
  dpr,
  w,
  h,
  inCall
}: {
  dpr: number
  w: number
  h: number
  inCall: boolean
}): number {
  const ratio = Number.isFinite(dpr) && dpr > 0 ? dpr : 1
  const area = w * h
  const byArea = area > 0 ? Math.sqrt(CANVAS_MAX_PIXELS / area) : Infinity
  return Math.min(ratio, 1.5, inCall ? 1 : Infinity, byArea)
}
