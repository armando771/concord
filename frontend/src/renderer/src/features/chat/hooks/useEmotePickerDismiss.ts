import { useEffect, type RefObject } from 'react'

/**
 * Fecha o seletor de emoji: clique fora (o botão que o abriu não conta, para
 * clicar nele de novo fechar em vez de reabrir) e Esc, que devolve o foco ao
 * botão. Flutuando ao lado de um botão (`floating`), rolar a lista ou
 * redimensionar a janela também fecha, pois o botão sai de baixo dele.
 */
export function useEmotePickerDismiss(
  ref: RefObject<HTMLElement | null>,
  anchor: HTMLElement | null,
  floating: boolean,
  onClose: () => void
): void {
  useEffect(() => {
    const inside = (e: Event): boolean =>
      e.target instanceof Node && !!ref.current?.contains(e.target)
    const onMouseDown = (e: MouseEvent): void => {
      if (!inside(e) && !anchor?.contains(e.target as Node)) onClose()
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      onClose()
      if (anchor?.isConnected) anchor.focus()
    }
    // A rolagem da própria lista de emojis não fecha.
    const onScroll = (e: Event): void => {
      if (!inside(e)) onClose()
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    if (floating) {
      window.addEventListener('scroll', onScroll, true)
      window.addEventListener('resize', onClose)
    }
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onClose)
    }
  }, [ref, anchor, floating, onClose])
}
