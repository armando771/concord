import { useEffect } from 'react'

/** Chama `onFechar` depois de `ms`, a menos que o diálogo feche antes. */
export function useFecharEm(ms: number, onFechar: () => void): void {
  useEffect(() => {
    const id = setTimeout(onFechar, ms)
    return () => clearTimeout(id)
  }, [ms, onFechar])
}
