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
