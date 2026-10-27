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
