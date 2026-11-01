// Onde o submenu (flyout) abre em relação ao menu pai. Puro, sem DOM: quem
// chama mede os retângulos e aplica o resultado.

export interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

export interface Point {
  x: number
  y: number
}

export type SubmenuSide = 'right' | 'left' | 'overlay'

export interface SubmenuPlacement {
  side: SubmenuSide
  left: number
  top: number
  width: number
}

export const SUBMENU_WIDTH = 224
const MARGIN = 8
/** O painel entra 2px por baixo do menu pai: não sobra fresta onde o mouse "cai". */
const OVERLAP = 2
/** Borda + padding do painel: o primeiro item do painel fica na altura do item pai. */
const PANEL_INSET = 9

function pickSide(parent: Box, viewportWidth: number): SubmenuSide {
  if (parent.right - OVERLAP + SUBMENU_WIDTH + MARGIN <= viewportWidth) return 'right'
  if (parent.left + OVERLAP - SUBMENU_WIDTH >= MARGIN) return 'left'
  return 'overlay'
}

/** Cabe ao lado do menu (direita ou esquerda)? Senão o submenu cobre o menu. */
export function fitsBeside(parent: Box, viewportWidth: number): boolean {
  return pickSide(parent, viewportWidth) !== 'overlay'
}

/**
 * Lado e posição do submenu. Ao lado do menu quando cabe (direita primeiro);
 * em tela estreita ele cobre o menu pai, com a mesma largura. Na vertical
 * acompanha o item e nunca sai da janela.
 */
export function placeSubmenu({
  trigger,
  parent,
  height,
  viewport
}: {
  trigger: Box
  parent: Box
  height: number
  viewport: { width: number; height: number }
}): SubmenuPlacement {
  const side = pickSide(parent, viewport.width)
  const wanted = side === 'overlay' ? parent.top : trigger.top - PANEL_INSET
  const top = Math.max(MARGIN, Math.min(wanted, viewport.height - MARGIN - height))
  if (side === 'overlay') return { side, left: parent.left, top, width: parent.right - parent.left }
  const left = side === 'right' ? parent.right - OVERLAP : parent.left + OVERLAP - SUBMENU_WIDTH
  return { side, left, top, width: SUBMENU_WIDTH }
}

const cross = (a: Point, b: Point, p: Point): number =>
  (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)

export function pointInTriangle(p: Point, a: Point, b: Point, c: Point): boolean {
  const signs = [cross(a, b, p), cross(b, c, p), cross(c, a, p)]
  return !(signs.some((s) => s < 0) && signs.some((s) => s > 0))
}

/**
 * O mouse saiu do item indo em direção ao painel? Vale se o ponto atual está
 * no triângulo entre o ponto anterior e a borda do painel que fica de frente.
 * Aí o submenu espera mais antes de fechar (o usuário corta caminho na diagonal
 * por cima de outros itens).
 */
export function isHeadingToPanel(
  prev: Point | null,
  cur: Point,
  panel: Box,
  side: SubmenuSide
): boolean {
  if (!prev || side === 'overlay') return false
  const edge = side === 'right' ? panel.left : panel.right
  return pointInTriangle(cur, prev, { x: edge, y: panel.top }, { x: edge, y: panel.bottom })
}

/** Estilo do painel: na primeira passada ainda não há posição medida. */
export function submenuPanelStyle(placement: SubmenuPlacement | null): {
  left: number
  top: number
  width: number
} {
  return {
    left: placement?.left ?? 0,
    top: placement?.top ?? 0,
    width: placement?.width ?? SUBMENU_WIDTH
  }
}
