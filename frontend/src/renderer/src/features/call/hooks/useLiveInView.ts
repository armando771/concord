import { useEffect, useId } from 'react'
import { useScreenVisibilityStore } from '../store/screenVisibilityStore'

/**
 * Avisa o screenVisibilityStore se este <video> da live de `userId` está na
 * área visível do app (qualquer pixel conta). null = não é live de outra pessoa.
 * Sem IntersectionObserver, conta como visível (nunca pausa por engano).
 */
export function useLiveInView(userId: string | null, ref: React.RefObject<Element | null>): void {
  const key = useId()

  useEffect(() => {
    const el = ref.current
    if (!userId || !el || typeof IntersectionObserver === 'undefined') return
    const { report, remove } = useScreenVisibilityStore.getState()
    report(key, userId, true)
    const observer = new IntersectionObserver((entries) => {
      const last = entries[entries.length - 1]
      if (last) report(key, userId, last.isIntersecting)
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      remove(key)
    }
  }, [key, userId, ref])
}
