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

/**
 * Um arrasto do mini-player, do pointerdown ao fim (pointerup, cancel, captura
 * perdida ou player escondido). Quem ativa "voltar para a chamada" é o click
 * (funciona também com leitor de tela e teclado); depois de um arrasto de
 * verdade o click seguinte é engolido.
 */
export class MiniPlayerGesture {
  private active: {
    pointerId: number
    x: number
    y: number
    start: MiniPlayerOffset
    last: MiniPlayerOffset
    moved: boolean
  } | null = null
  private swallowClick = false

  /** Arrastando agora (já passou do limite de clique). */
  get dragging(): boolean {
    return this.active?.moved ?? false
  }

  down(pointerId: number, x: number, y: number, start: MiniPlayerOffset): void {
    this.active = { pointerId, x, y, start, last: start, moved: false }
    this.swallowClick = false
  }

  /** Nova posição (já reencaixada) se é arrasto; null se ainda é clique. */
  move(
    pointerId: number,
    x: number,
    y: number,
    fit: (offset: MiniPlayerOffset) => MiniPlayerOffset
  ): MiniPlayerOffset | null {
    const a = this.active
    if (!a || a.pointerId !== pointerId) return null
    const dx = x - a.x
    const dy = y - a.y
    if (!a.moved && !isDrag(dx, dy)) return null
    a.moved = true
    a.last = fit(draggedOffset(a.start, dx, dy))
    return a.last
  }

  /**
   * Fim do gesto (sem `pointerId`: qualquer um, ex.: player escondido).
   * Devolve a posição para salvar se houve arrasto.
   */
  end(pointerId?: number): MiniPlayerOffset | null {
    const a = this.active
    if (!a || (pointerId !== undefined && a.pointerId !== pointerId)) return null
    this.active = null
    this.swallowClick = a.moved
    return a.moved ? a.last : null
  }

  /** No click: true = ativar; false = era o fim de um arrasto. */
  takeClick(): boolean {
    const swallow = this.swallowClick
    this.swallowClick = false
    return !swallow
  }
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
