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
