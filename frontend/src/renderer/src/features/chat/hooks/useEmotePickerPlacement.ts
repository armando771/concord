import { useLayoutEffect, useState, type RefObject } from 'react'
import { useIsMobile } from '../../navigation/hooks/useIsMobile'
import {
  emotePickerPlacement,
  emotePickerStyle,
  scrollParentOf
} from '../lib/emotePickerPlacement'

/** Área visível da lista que rola (ou da janela), já cortada pela janela. */
function visibleArea(list: HTMLElement | null): { top: number; bottom: number } {
  const rect = list?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight }
  return { top: Math.max(rect.top, 0), bottom: Math.min(rect.bottom, window.innerHeight) }
}

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
    const el = ref.current
    const row = el?.offsetParent
    if (mobile || !el || !row) {
      setStyle(undefined)
      return
    }
    const list = scrollParentOf(el, (n) => getComputedStyle(n).overflowY)
    const area = visibleArea(list)
    const placed = emotePickerPlacement({
      rowTop: row.getBoundingClientRect().top,
      containerTop: area.top,
      containerBottom: area.bottom,
      height: el.offsetHeight
    })
    setStyle(emotePickerStyle(placed))
  }, [mobile, ref])

  return style
}
