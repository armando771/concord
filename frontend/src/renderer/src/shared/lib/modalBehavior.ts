import { focusableIn } from './focusTrap'
import type { ModalStack } from './modalStack'

export interface AttachModalOptions {
  /** Identifica este modal na pilha. */
  id: string
  win: EventTarget
  doc: Document
  stack: ModalStack
  /** O diálogo (onde o foco entra e fica preso). */
  getRoot: () => HTMLElement | null
  close: () => void
  /** Falso quando fechar não vale agora (ex.: salvando). */
  canClose: () => boolean
}

/**
 * Comportamento de um modal aberto: o foco entra nele (sem roubar de quem já
 * está dentro, como um campo com autoFocus), Esc fecha o do topo da pilha e,
 * ao fechar, o foco volta para onde estava. Devolve a função que desfaz tudo.
 */
export function attachModal(o: AttachModalOptions): () => void {
  o.stack.push(o.id)
  const previous = o.doc.activeElement as HTMLElement | null
  const root = o.getRoot()
  if (root && !root.contains(o.doc.activeElement)) focusableIn(root)[0]?.focus()

  const onKey = (e: Event): void => {
    const key = e as KeyboardEvent
    if (key.defaultPrevented || key.key !== 'Escape') return
    if (!o.stack.isTop(o.id) || !o.canClose()) return
    key.preventDefault()
    o.close()
  }
  o.win.addEventListener('keydown', onKey)

  return () => {
    o.win.removeEventListener('keydown', onKey)
    o.stack.remove(o.id)
    if (previous?.isConnected) previous.focus()
  }
}
