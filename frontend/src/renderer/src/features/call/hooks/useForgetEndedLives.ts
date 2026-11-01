import { useEffect } from 'react'
import { useCallStore } from '../store/callStore'
import { useAnnotationStore } from '../store/annotationStore'

/**
 * Quando uma live acaba, esquece o "ocultar desenhos" dela: se a pessoa
 * transmitir de novo, os desenhos voltam a aparecer (padrão). Ao sair da
 * call, o `callStore` já zera tudo.
 */
export function useForgetEndedLives(): void {
  const screenSharers = useCallStore((s) => s.screenSharers)
  useEffect(() => {
    useAnnotationStore.getState().pruneHidden(screenSharers)
  }, [screenSharers])
}
