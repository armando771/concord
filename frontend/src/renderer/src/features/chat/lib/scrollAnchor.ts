/**
 * Âncora de rolagem das páginas antigas (scroll infinito): a mensagem que era a
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

/** Reservas da âncora do loadOlder (a primeira e as seguintes). */
export const ANCHOR_CANDIDATES = 20

/**
 * As primeiras mensagens da lista que estão desenhadas, com a posição de
 * cada uma no conteúdo: a primeira é a âncora, as seguintes, reservas.
 */
export function anchorCandidates(
  ids: string[],
  offsetOf: (id: string) => number | null,
  max = ANCHOR_CANDIDATES
): AnchorCandidate[] {
  const candidates: AnchorCandidate[] = []
  for (const id of ids.slice(0, max)) {
    const offset = offsetOf(id)
    if (offset !== null) candidates.push({ id, offset })
  }
  return candidates
}

/** Âncora guardada antes de carregar a página antiga de uma sala. */
export interface OlderAnchor {
  room: string
  candidates: AnchorCandidate[]
}

/**
 * Depois de uma mudança na lista: a âncora que continua guardada e o novo
 * scrollTop (null: não mexe). Só gasta a âncora quando a página antiga entrou
 * em cima; mensagem ao vivo embaixo (ou a de cima apagada) não conta.
 */
export function restoreOlderAnchor(input: {
  anchor: OlderAnchor | null
  room: string
  firstId: string | undefined
  scrollTop: number
  /** Posição da mensagem no conteúdo; null se ela não está desenhada. */
  offsetOf: (id: string) => number | null
}): { anchor: OlderAnchor | null; scrollTop: number | null } {
  const { anchor } = input
  if (!anchor || !olderPagePrepended(input.firstId, anchor.candidates)) {
    return { anchor, scrollTop: null }
  }
  if (anchor.room !== input.room) return { anchor: null, scrollTop: null }
  const kept = pickAnchor(anchor.candidates, (id) => input.offsetOf(id) !== null)
  if (!kept) return { anchor: null, scrollTop: null }
  const current = input.offsetOf(kept.id) ?? kept.offset
  return { anchor: null, scrollTop: anchoredScrollTop(input.scrollTop, kept.offset, current) }
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
