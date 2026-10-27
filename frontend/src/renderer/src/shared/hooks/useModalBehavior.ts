import { useEffect, useId, useRef, type RefObject } from 'react'
import { attachModal } from '../lib/modalBehavior'
import { modalStack } from '../lib/modalStack'

/**
 * Foco, Esc e pilha de um modal aberto (ver lib/modalBehavior). `onClose`
 * indefinido = não dá para fechar agora (o Esc não faz nada).
 */
export function useModalBehavior(
  open: boolean,
  onClose: (() => void) | undefined,
  dialogRef: RefObject<HTMLElement | null>
): void {
  const id = useId()
  // O Esc usa sempre o onClose mais novo, sem reabrir o modal a cada render.
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    return attachModal({
      id,
      win: window,
      doc: document,
      stack: modalStack,
      getRoot: () => dialogRef.current,
      close: () => closeRef.current?.(),
      canClose: () => closeRef.current !== undefined
    })
  }, [open, id, dialogRef])
}
