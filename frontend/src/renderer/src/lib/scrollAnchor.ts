/**
 * Âncora de rolagem do "Carregar mensagens anteriores": a mensagem que era a
 * primeira da lista fica no mesmo lugar da tela depois que a página antiga
 * entra em cima dela.
 *
 * A posição guardada é a do elemento dentro do conteúdo rolável (não a altura
 * total), então o que chega embaixo durante a espera (mensagem ao vivo) não
 * entra na conta, e o ajuste é somado ao scrollTop atual: se a pessoa rolou
 * enquanto esperava, continua onde rolou.
 */

/** Posição do topo do elemento dentro do conteúdo rolável do scroller. */
export function contentOffset(elementTop: number, scrollerTop: number, scrollTop: number): number {
  return elementTop - scrollerTop + scrollTop
}

/** scrollTop que mantém a âncora parada: soma só o quanto ela desceu. */
export function anchoredScrollTop(
  scrollTop: number,
  savedOffset: number,
  currentOffset: number
): number {
  return scrollTop + (currentOffset - savedOffset)
}

export function measureOffset(scroller: HTMLElement, element: HTMLElement): number {
  return contentOffset(
    element.getBoundingClientRect().top,
    scroller.getBoundingClientRect().top,
    scroller.scrollTop
  )
}

/** Mensagem já carregada no clique e sua posição no conteúdo naquele momento. */
export interface AnchorCandidate {
  id: string
  offset: number
}

/**
 * Âncora usada na volta: a antiga primeira mensagem ou, se ela foi apagada
 * durante o carregamento, a mais próxima dela que ainda está na tela.
 */
export function pickAnchor(
  candidates: AnchorCandidate[],
  isPresent: (id: string) => boolean
): AnchorCandidate | null {
  return candidates.find((c) => isPresent(c.id)) ?? null
}

/**
 * Entrou página antiga em cima? A nova primeira não é nenhuma das que já
 * estavam (se for, só sumiu a de cima — apagada — e a página ainda vem).
 */
export function olderPagePrepended(
  firstId: string | undefined,
  candidates: AnchorCandidate[]
): boolean {
  return firstId !== undefined && !candidates.some((c) => c.id === firstId)
}

/**
 * Rolagem ao fim da conversa. Ao abrir a sala (e enquanto ela carrega), a
 * lista aparece já no fim, de uma vez e antes de pintar; só mensagem nova
 * depois disso, com a pessoa já no fim, rola suavemente.
 */
export type BottomScroll = 'none' | 'instant' | 'smooth'

export function bottomScrollPlan(input: {
  /** Sala que já foi posicionada no fim (null: nenhuma ainda). */
  positionedRoom: string | null
  room: string
  loading: boolean
  stickToBottom: boolean
  /** Entrou ou saiu algo no fim da lista desde a última checagem. */
  countChanged: boolean
}): { scroll: BottomScroll; positionedRoom: string | null } {
  // Carregando (ou recarregando): o próximo conteúdo é uma abertura nova.
  if (input.loading) return { scroll: 'none', positionedRoom: null }
  if (input.positionedRoom !== input.room) {
    return { scroll: 'instant', positionedRoom: input.room }
  }
  return {
    scroll: input.stickToBottom && input.countChanged ? 'smooth' : 'none',
    positionedRoom: input.positionedRoom
  }
}

/** Duração do destaque ao pular para uma mensagem (igual ao .msg-jump-highlight). */
export const JUMP_HIGHLIGHT_MS = 2000
