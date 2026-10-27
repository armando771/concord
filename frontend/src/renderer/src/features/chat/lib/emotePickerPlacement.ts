// Para que lado abre o seletor de emoji da reação. Ele fica preso à linha da
// mensagem (ou do comentário): por padrão abre logo abaixo da barra de ações
// (top-8). Perto do fim da lista não cabe e ficava cortado pela lista que
// rola (atrás do campo de mensagem); aí abre acima da barra. Sem caber em
// nenhum lado, fica no lado com mais espaço e com a altura limitada.

/** Distância do topo da linha até o topo do seletor aberto para baixo (top-8). */
export const BELOW_OFFSET = 32
/** Distância do topo da linha até a base do seletor aberto para cima (acima da barra). */
export const ABOVE_OFFSET = 20
/** Folga até a borda da lista. */
const MARGIN = 8
/** Menos que isto não dá para usar (busca + uma fileira e pouco). */
const MIN_HEIGHT = 140

export interface EmotePickerPlacement {
  side: 'below' | 'above'
  /** Altura máxima em px quando não cabe inteiro; null = altura natural. */
  maxHeight: number | null
}

export function emotePickerPlacement(m: {
  /** Topo da linha (a referência do `absolute`), na tela. */
  rowTop: number
  /** Área visível da lista que rola (já cortada pela janela). */
  containerTop: number
  containerBottom: number
  /** Altura natural do seletor. */
  height: number
}): EmotePickerPlacement {
  const below = m.containerBottom - (m.rowTop + BELOW_OFFSET) - MARGIN
  const above = m.rowTop - ABOVE_OFFSET - m.containerTop - MARGIN
  if (m.height <= below) return { side: 'below', maxHeight: null }
  if (m.height <= above) return { side: 'above', maxHeight: null }
  const side = below >= above ? 'below' : 'above'
  return { side, maxHeight: Math.max(side === 'below' ? below : above, MIN_HEIGHT) }
}

/** Posição do seletor em relação à linha (o `absolute` dele). */
export function emotePickerStyle(p: EmotePickerPlacement): {
  top: number | 'auto'
  bottom: string
  maxHeight?: number
} {
  const pos =
    p.side === 'below'
      ? { top: BELOW_OFFSET, bottom: 'auto' }
      : { top: 'auto' as const, bottom: `calc(100% + ${ABOVE_OFFSET}px)` }
  return p.maxHeight === null ? pos : { ...pos, maxHeight: p.maxHeight }
}

/** O ancestral que rola na vertical (a lista de mensagens), ou null (a janela). */
export function scrollParentOf<T extends { parentElement: T | null }>(
  el: T,
  overflowY: (node: T) => string
): T | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (/(auto|scroll)/.test(overflowY(node))) return node
  }
  return null
}
