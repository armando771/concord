// Teclado dos menus (setinha do microfone/fone): setas, Home e End movem o
// foco entre os itens, dando a volta nas pontas. Puro, sem DOM.

/** Próximo item a focar, ou null se a tecla não é de navegação. -1 = nenhum focado. */
export function nextMenuIndex(current: number, count: number, key: string): number | null {
  if (count === 0) return null
  switch (key) {
    case 'ArrowDown':
      return current < 0 ? 0 : (current + 1) % count
    case 'ArrowUp':
      return current < 0 ? count - 1 : (current - 1 + count) % count
    case 'Home':
      return 0
    case 'End':
      return count - 1
    default:
      return null
  }
}
