import { useMemo, useSyncExternalStore } from 'react'

/**
 * Fonte para o useSyncExternalStore: se a consulta de mídia casa agora e
 * quando muda. Sem matchMedia (testes), vale `fallback`.
 */
export function mediaQuerySource(
  query: string,
  fallback = false
): { subscribe: (onChange: () => void) => () => void; getSnapshot: () => boolean } {
  const media = (): MediaQueryList | null =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query)
      : null
  return {
    subscribe: (onChange) => {
      const mql = media()
      mql?.addEventListener('change', onChange)
      return () => mql?.removeEventListener('change', onChange)
    },
    getSnapshot: () => media()?.matches ?? fallback
  }
}

/** A consulta de mídia casa (ex.: '(min-width: 768px)')? Atualiza ao redimensionar. */
export function useMediaQuery(query: string, fallback = false): boolean {
  const source = useMemo(() => mediaQuerySource(query, fallback), [query, fallback])
  // O app não tem SSR: a leitura do servidor é a mesma (e sem window vale o padrão).
  return useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot)
}
