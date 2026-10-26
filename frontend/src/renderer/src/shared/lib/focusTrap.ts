/**
 * Foco preso num diálogo (aria-modal): Tab no último volta para o primeiro e
 * Shift+Tab no primeiro vai para o último.
 */

/** Índice que deve receber o foco, ou null para deixar o Tab seguir. */
export function wrapFocusIndex(current: number, count: number, backwards: boolean): number | null {
  if (count === 0) return null
  // Foco fora do diálogo (ou em nada focável): entra pela ponta certa.
  if (current < 0) return backwards ? count - 1 : 0
  if (backwards && current === 0) return count - 1
  if (!backwards && current === count - 1) return 0
  return null
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE))
}

/** onKeyDown do diálogo: prende o Tab dentro dele. */
export function trapTab(e: KeyboardEvent | React.KeyboardEvent, root: HTMLElement | null): void {
  if (e.key !== 'Tab' || !root) return
  const items = focusableIn(root)
  const index = wrapFocusIndex(
    items.indexOf(document.activeElement as HTMLElement),
    items.length,
    e.shiftKey
  )
  if (index === null) return
  e.preventDefault()
  items[index]?.focus()
}
