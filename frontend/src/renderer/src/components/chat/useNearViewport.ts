import { useEffect, useState } from 'react'

/** Ancestral que rola (a lista de mensagens), para a margem valer dentro dele. */
function scrollParent(el: Element): Element | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node)
    if (overflowY === 'auto' || overflowY === 'scroll') return node
  }
  return null
}

/**
 * true quando o elemento chega perto da área visível (rootMargin de folga) e
 * fica true para sempre: a mídia só começa a baixar quando vai aparecer.
 */
export function useNearViewport(
  ref: React.RefObject<Element | null>,
  rootMargin = '400px'
): boolean {
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    const el = ref.current
    if (near || !el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true)
          observer.disconnect()
        }
      },
      { root: scrollParent(el), rootMargin }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, rootMargin, near])

  return near
}
