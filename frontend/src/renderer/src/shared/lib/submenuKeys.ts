// Teclado do submenu. Puro, sem DOM. A navegação entre itens reaproveita
// `menuNav` (setas, Home e End).
import { nextMenuIndex } from './menuNav'

/** No item pai: a seta para a direita abre (Enter e Espaço chegam como clique). */
export function opensSubmenu(key: string): boolean {
  return key === 'ArrowRight'
}

/** No painel aberto: 'close' (Esc ou seta para a esquerda) ou o índice do item a focar. */
export function submenuKeyAction(
  key: string,
  current: number,
  count: number
): 'close' | number | null {
  if (key === 'Escape' || key === 'ArrowLeft') return 'close'
  return nextMenuIndex(current, count, key)
}
