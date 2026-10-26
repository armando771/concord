import { useEffect, useEffectEvent, useRef } from 'react'
import { reachedTop, TOP_PRELOAD_MARGIN, topWatchTargets } from '../lib/infiniteScroll'

/**
 * Carrega a página antiga sozinho quando o topo da lista chega perto da área
 * visível. Devolve o ref do sentinela (o primeiro item da lista).
 *
 * O observer é refeito a cada página que entra (resetKey): se o sentinela
 * continua à vista (lista curta), o aviso inicial já pede a próxima. Uma
 * falha não muda a lista, então não repete sozinha: a próxima tentativa vem
 * quando a pessoa rolar de novo até o topo.
 */
export function useInfiniteScrollOlder({
  scrollRef,
  active,
  resetKey,
  onReachTop
}: {
  scrollRef: React.RefObject<HTMLElement | null>
  /** Há páginas antigas e a sala já carregou. */
  active: boolean
  /** Muda quando entra página nova (ex.: sala + id da primeira mensagem). */
  resetKey: string
  /** Quem chama evita carregar duas vezes em paralelo. */
  onReachTop: () => void
}): React.RefObject<HTMLDivElement | null> {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const reach = useEffectEvent(onReachTop)

  useEffect(() => {
    const targets = topWatchTargets(active, scrollRef.current, sentinelRef.current)
    if (!targets) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (reachedTop(entries)) reach()
      },
      { root: targets.root, rootMargin: TOP_PRELOAD_MARGIN }
    )
    observer.observe(targets.target)
    return () => observer.disconnect()
  }, [active, resetKey, scrollRef])

  return sentinelRef
}
