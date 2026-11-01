export interface KeyLike {
  key: string
  preventDefault: () => void
}

export interface RowInteraction {
  role?: 'button'
  tabIndex?: 0
  onKeyDown?: (e: KeyLike) => void
  className: string
}

/** Enter e espaço ativam a linha, como num botão. */
export const isActivationKey = (key: string): boolean => key === 'Enter' || key === ' '

/** Linha clicável vira botão para teclado e leitor de tela; sem clique, fica inerte. */
export function rowInteraction(onClick?: () => void): RowInteraction {
  if (!onClick) return { className: '' }
  return {
    role: 'button',
    tabIndex: 0,
    className: 'cursor-pointer',
    onKeyDown: (e) => {
      if (!isActivationKey(e.key)) return
      e.preventDefault()
      onClick()
    }
  }
}
