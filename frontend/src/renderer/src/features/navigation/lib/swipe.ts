// Gesto de arrastar para a direita no conteúdo (celular): volta para a lista,
// como no Discord mobile. Os botões continuam sendo o caminho principal.

/** Mínimo de px na horizontal para virar gesto. */
const MIN_DX = 80
/** Beirada da tela reservada ao "voltar" do sistema (iOS/Android). */
const EDGE = 24
/** Mais lento que isto é arrastar com calma (selecionar, mover algo). */
const MAX_MS = 800

export function isSwipeToList(s: {
  startX: number
  width: number
  dx: number
  dy: number
  ms: number
}): boolean {
  if (s.startX < EDGE || s.startX > s.width - EDGE) return false
  if (s.dx < MIN_DX || s.ms > MAX_MS) return false
  // Bem mais horizontal que vertical (não é rolagem).
  return Math.abs(s.dy) * 2 < s.dx
}

export interface SwipeTracker {
  /** Dedo encostou: quantos dedos e se começou num lugar com gesto próprio. */
  start: (p: { x: number; y: number; t: number; fingers: number; own: boolean }) => void
  /** Dedo saiu (null se o navegador não disse onde). */
  end: (p: { x: number; y: number; t: number; width: number } | null) => void
}

/** Junta o começo e o fim do toque e chama onSwipe quando foi o gesto. */
export function createSwipeTracker(onSwipe: () => void): SwipeTracker {
  let from: { x: number; y: number; t: number } | null = null
  return {
    start: (p) => {
      from = p.fingers === 1 && !p.own ? { x: p.x, y: p.y, t: p.t } : null
    },
    end: (p) => {
      const s = from
      from = null
      if (!s || !p) return
      const swipe = { startX: s.x, width: p.width, dx: p.x - s.x, dy: p.y - s.y, ms: p.t - s.t }
      if (isSwipeToList(swipe)) onSwipe()
    }
  }
}
