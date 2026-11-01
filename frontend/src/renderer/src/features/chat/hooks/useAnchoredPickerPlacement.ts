import { useLayoutEffect, useState, type RefObject } from 'react'
import { anchoredPickerStyle } from '../lib/reactionPicker'

/**
 * Mede, antes de pintar, onde o seletor de emoji fica ao lado do botão
 * `anchor` (o "+" dos chips), sem sair da janela. Sem âncora devolve
 * undefined: valem as classes (canto da linha ou folha de baixo).
 */
export function useAnchoredPickerPlacement(
  ref: RefObject<HTMLElement | null>,
  anchor: HTMLElement | null
): React.CSSProperties | undefined {
  const [style, setStyle] = useState<React.CSSProperties>()

  useLayoutEffect(() => {
    const el = ref.current
    setStyle(
      el && anchor
        ? anchoredPickerStyle(
            anchor.getBoundingClientRect(),
            { width: el.offsetWidth, height: el.offsetHeight },
            { width: window.innerWidth, height: window.innerHeight }
          )
        : undefined
    )
  }, [ref, anchor])

  return style
}
