// Arraste da caixa do overlay no modo de edição (mover e redimensionar). Puro.

import {
  moveOverlayBox,
  pixelsToFraction,
  resizeOverlayScale,
  type OverlayBoxPx,
  type OverlayLayout,
  type OverlaySize
} from './overlayLayout'

export interface BoxDrag {
  mode: 'move' | 'resize'
  pointerId: number
  x0: number
  y0: number
  start: OverlayBoxPx
  startBox: OverlaySize
  startLayout: OverlayLayout
  /** Layout salvo no começo do arraste. */
  base: OverlayLayout
}

export interface BoxDragStart {
  mode: BoxDrag['mode']
  pointerId: number
  x: number
  y: number
  /** Onde a caixa está agora, em px. */
  pos: OverlayBoxPx
  box: OverlaySize
  /** Layout em uso (o salvo ou o rascunho). */
  layout: OverlayLayout
  area: OverlaySize
  saved: OverlayLayout
}

export function startBoxDrag(s: BoxDragStart): BoxDrag {
  return {
    mode: s.mode,
    pointerId: s.pointerId,
    x0: s.x,
    y0: s.y,
    start: s.pos,
    startBox: s.box,
    // Redimensionar segura o canto de cima à esquerda onde ele está.
    startLayout: { ...s.layout, position: s.layout.position ?? pixelsToFraction(s.pos, s.area) },
    base: s.saved
  }
}

/** Layout depois de o ponteiro andar (dx, dy) desde o começo do arraste. */
export function dragLayout(d: BoxDrag, dx: number, dy: number, area: OverlaySize): OverlayLayout {
  return d.mode === 'move'
    ? { ...d.startLayout, position: moveOverlayBox(d.start, dx, dy, area, d.startBox) }
    : { ...d.startLayout, scale: resizeOverlayScale(d.startLayout.scale, d.startBox, dx, dy) }
}

/** Dica do modo de edição: embaixo se couber (senão em cima), à direita se a caixa está na metade direita. */
export function hintPlacement(
  pos: OverlayBoxPx,
  box: OverlaySize,
  area: OverlaySize
): { below: boolean; right: boolean } {
  return {
    below: pos.top + box.height + 40 <= area.height,
    right: pos.left + box.width / 2 > area.width / 2
  }
}

/** Classes de posição da dica em volta da caixa (ver hintPlacement). */
export function hintPositionClass(pos: OverlayBoxPx, box: OverlaySize, area: OverlaySize): string {
  const { below, right } = hintPlacement(pos, box, area)
  return `${below ? 'top-full mt-3' : 'bottom-full mb-3'} ${right ? 'right-0' : 'left-0'}`
}

/** Classes da caixa: w-max (a largura não depende da janela); editando, moldura tracejada. */
export function boxClassName(editing: boolean): string {
  const frame = editing
    ? 'cursor-move border-dashed border-brand bg-black/20'
    : 'border-transparent'
  return `absolute w-max rounded-xl border-2 p-2 ${frame}`
}
