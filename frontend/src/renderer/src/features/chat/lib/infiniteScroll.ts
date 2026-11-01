/**
 * Scroll infinito para cima: um sentinela no topo da lista é observado e,
 * quando chega perto da área visível, a página antiga é carregada.
 */

/** Folga acima da área visível: a página antiga começa a vir antes de chegar no topo. */
export const TOP_PRELOAD_MARGIN = '600px 0px 0px 0px'

/** Algum aviso do observer diz que o sentinela do topo está à vista (com a folga). */
export function reachedTop(entries: ReadonlyArray<{ isIntersecting: boolean }>): boolean {
  return entries.some((e) => e.isIntersecting)
}

/**
 * O que observar: só com páginas antigas por vir, a lista desenhada (scroller
 * e sentinela na tela) e IntersectionObserver no ambiente. null: não observa.
 */
export function topWatchTargets<R, T>(
  active: boolean,
  root: R | null,
  target: T | null
): { root: R; target: T } | null {
  if (!active || !root || !target) return null
  return typeof IntersectionObserver === 'undefined' ? null : { root, target }
}
