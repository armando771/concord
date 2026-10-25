export interface Rect {
  top: number
  left: number
  right: number
  bottom: number
}

/** Lado preferido do cartão em relação ao que foi clicado. */
export type CardSide = 'left' | 'right'

const MARGIN = 8

/**
 * Onde abrir o cartão de perfil (como no Discord): ao lado do que foi
 * clicado, no lado preferido; se não couber, no outro lado; e sempre dentro
 * da janela, alinhado ao topo do item clicado quando der.
 */
export function placeProfileCard(
  anchor: Rect,
  side: CardSide,
  card: { width: number; height: number },
  viewport: { width: number; height: number }
): { left: number; top: number } {
  const leftOf = anchor.left - MARGIN - card.width
  const rightOf = anchor.right + MARGIN
  const fitsLeft = leftOf >= MARGIN
  const fitsRight = rightOf + card.width <= viewport.width - MARGIN

  let left = side === 'left' ? (fitsLeft ? leftOf : rightOf) : fitsRight ? rightOf : leftOf
  left = Math.min(Math.max(MARGIN, left), viewport.width - card.width - MARGIN)

  const maxTop = viewport.height - card.height - MARGIN
  const top = Math.max(MARGIN, Math.min(anchor.top, maxTop))
  return { left, top }
}

/** "25 de out. de 2026". */
export function formatMemberSince(iso: string | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
}
