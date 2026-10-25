// Posição do mini-player da transmissão (ScreenMiniPlayer), que dá para
// arrastar. Guardada como distância do canto inferior direito: ao redimensionar
// a janela ele acompanha o canto, como antes. Puro, sem React.

/** Distância (px) das bordas direita e inferior da janela. */
export interface MiniPlayerOffset {
  right: number
  bottom: number
}

/** Área onde ele pode ficar: a janela menos a barra de título (`top`). */
export interface MiniPlayerViewport {
  width: number
  height: number
  top: number
}

const KEY = 'concord:mini-player-offset'

/** Canto de sempre (bottom-24 right-4). */
export const DEFAULT_MINI_PLAYER_OFFSET: MiniPlayerOffset = { right: 16, bottom: 96 }

/** Até aqui de movimento ainda conta como clique (volta para a chamada). */
export const DRAG_THRESHOLD_PX = 4

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

/** Mantém o mini-player inteiro à vista (salvo fora da tela, janela menor…). */
export function clampMiniPlayer(
  offset: MiniPlayerOffset,
  size: { width: number; height: number },
  viewport: MiniPlayerViewport
): MiniPlayerOffset {
  const maxRight = Math.max(0, viewport.width - size.width)
  const maxBottom = Math.max(0, viewport.height - viewport.top - size.height)
  return { right: clamp(offset.right, 0, maxRight), bottom: clamp(offset.bottom, 0, maxBottom) }
}

/** Andou o bastante desde o pointerdown para ser arrasto (e não clique)? */
export function isDrag(dx: number, dy: number, threshold = DRAG_THRESHOLD_PX): boolean {
  return Math.hypot(dx, dy) >= threshold
}

/** Nova posição depois de arrastar dx/dy (px de tela) a partir de `start`. */
export function draggedOffset(start: MiniPlayerOffset, dx: number, dy: number): MiniPlayerOffset {
  return { right: start.right - dx, bottom: start.bottom - dy }
}

export function parseMiniPlayerOffset(raw: string | null): MiniPlayerOffset {
  try {
    const parsed = JSON.parse(raw ?? 'null') as Partial<MiniPlayerOffset> | null
    const { right, bottom } = parsed ?? {}
    if (typeof right === 'number' && typeof bottom === 'number') {
      if (Number.isFinite(right) && Number.isFinite(bottom)) return { right, bottom }
    }
  } catch {
    // valor estragado: volta ao canto padrão
  }
  return { ...DEFAULT_MINI_PLAYER_OFFSET }
}

// Lembrado neste computador; sem armazenamento disponível, começa no canto.
export function loadMiniPlayerOffset(): MiniPlayerOffset {
  try {
    return parseMiniPlayerOffset(localStorage.getItem(KEY))
  } catch {
    return { ...DEFAULT_MINI_PLAYER_OFFSET }
  }
}

export function saveMiniPlayerOffset(offset: MiniPlayerOffset): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(offset))
  } catch {
    // armazenamento indisponível: a posição vale só nesta sessão
  }
}
