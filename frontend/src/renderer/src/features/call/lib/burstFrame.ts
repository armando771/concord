/**
 * Onde desenhar o burst de nível que vai num portal (LevelUpBurst): segue o
 * avatar quadro a quadro e some quando o avatar sai da área visível dos
 * containers com overflow cortado (lista rolada, tile da chamada…).
 */
export interface Box {
  left: number
  top: number
  width: number
  height: number
}

export interface BurstFrame extends Box {
  visible: boolean
}

/** Interseção da janela com os retângulos dos containers que cortam conteúdo. */
export function clipRect(viewport: Box, clips: Box[]): Box {
  let left = viewport.left
  let top = viewport.top
  let right = viewport.left + viewport.width
  let bottom = viewport.top + viewport.height
  for (const c of clips) {
    left = Math.max(left, c.left)
    top = Math.max(top, c.top)
    right = Math.min(right, c.left + c.width)
    bottom = Math.min(bottom, c.top + c.height)
  }
  return { left, top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
}

/** Posição do avatar; visível só se o centro dele está dentro de `clip`. */
export function anchorFrame(anchor: Box, clip: Box): BurstFrame {
  const cx = anchor.left + anchor.width / 2
  const cy = anchor.top + anchor.height / 2
  const visible =
    anchor.width > 0 &&
    anchor.height > 0 &&
    cx >= clip.left &&
    cx <= clip.left + clip.width &&
    cy >= clip.top &&
    cy <= clip.top + clip.height
  return { left: anchor.left, top: anchor.top, width: anchor.width, height: anchor.height, visible }
}

/** Mesma posição (diferença de subpixel não conta) e mesma visibilidade. */
export function frameEquals(a: BurstFrame | null, b: BurstFrame): boolean {
  if (!a) return false
  const near = (x: number, y: number): boolean => Math.abs(x - y) < 0.5
  return (
    a.visible === b.visible &&
    near(a.left, b.left) &&
    near(a.top, b.top) &&
    near(a.width, b.width) &&
    near(a.height, b.height)
  )
}
