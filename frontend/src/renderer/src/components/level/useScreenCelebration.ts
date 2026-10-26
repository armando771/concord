import { useEffect, useMemo } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useLevelStore } from '../../store/levelStore'

export interface ScreenCelebration {
  /** Muda a cada celebração, para reiniciar a animação. */
  key: number
  userId: string
  level: number
  previous: number
  /** A celebração é sua (subiu de nível ou clicou no seu selo). */
  own: boolean
  /** Nome de quem é, quando é a de outra pessoa. */
  name?: string
}

/**
 * Qual celebração ocupa a tela agora: a sua (subida de verdade, prévia ou
 * clique no seu selo) ou, se não houver, a do nível de outra pessoa que você
 * mandou tocar no cartão dela.
 */
export function useScreenCelebration(): ScreenCelebration | null {
  const meId = useAuthStore((s) => s.user?.id)
  const mine = useLevelStore((s) => (meId ? s.celebrations[meId] : undefined))
  const showcase = useLevelStore((s) => s.showcase)

  return useMemo(() => {
    if (meId && mine) {
      return { key: mine.key, userId: meId, level: mine.level, previous: mine.previous, own: true }
    }
    if (showcase) {
      return {
        key: showcase.key,
        userId: showcase.userId,
        level: showcase.level,
        previous: showcase.previous,
        own: false,
        name: showcase.name
      }
    }
    return null
  }, [meId, mine, showcase])
}

/**
 * Sua subida de nível que chegou com a janela fora de vista fica na fila
 * (levelStore). Quando a janela volta (foco ou visível), toca a mais alta.
 */
export function useFlushPendingLevelUp(): void {
  useEffect(() => {
    const flush = (): void => useLevelStore.getState().flushPending()
    window.addEventListener('focus', flush)
    document.addEventListener('visibilitychange', flush)
    return () => {
      window.removeEventListener('focus', flush)
      document.removeEventListener('visibilitychange', flush)
    }
  }, [])
}
