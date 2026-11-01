import { useLayoutEffect, useState, type RefObject } from 'react'
import { useIsMobile } from '../../navigation/hooks/useIsMobile'
import { measureEmotePicker } from '../lib/emotePickerPlacement'

/**
 * Mede, antes de pintar, se o seletor de emoji cabe abaixo da barra de ações
 * dentro da lista que rola; se não, abre acima (lib/emotePickerPlacement).
 * No celular ele é folha de baixo e não precisa disto.
 */
export function useEmotePickerPlacement(
  ref: RefObject<HTMLElement | null>
): React.CSSProperties | undefined {
  const mobile = useIsMobile()
  const [style, setStyle] = useState<React.CSSProperties>()

  useLayoutEffect(() => {
    setStyle(
      measureEmotePicker(ref.current, {
        mobile,
        height: window.innerHeight,
        overflowY: (node) => getComputedStyle(node as unknown as Element).overflowY
      })
    )
  }, [mobile, ref])

  return style
}
