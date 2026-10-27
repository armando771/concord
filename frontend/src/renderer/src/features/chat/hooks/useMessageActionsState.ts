import { useState } from 'react'
import { createLongPress, swallowNextClick, type LongPress } from '../../../shared/lib/longPress'

export interface MessageActionsState {
  /**
   * A barra de ações aparece: mouse em cima (no toque, ao tocar), foco do
   * teclado dentro da linha, seletor de emoji ou menu "Mais" abertos.
   */
  showBar: boolean
  pickerOpen: boolean
  togglePicker: () => void
  closePicker: () => void
  menuOpen: boolean
  setMenuOpen: (open: boolean) => void
  /**
   * contextmenu da linha vindo do toque (segurar o dedo no Android): abre o
   * menu "Mais" no lugar do menu do autor. Devolve se tratou.
   */
  touchMenu: (e: React.MouseEvent) => boolean
  /** Vai na linha da mensagem. */
  rowProps: {
    onMouseEnter: () => void
    onMouseLeave: () => void
    onFocus: (e: React.FocusEvent<HTMLElement>) => void
    onBlur: (e: React.FocusEvent<HTMLElement>) => void
    /** Segurar o dedo na mensagem abre o "Mais" (no iOS não há contextmenu). */
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => void
    onPointerMove: (e: React.PointerEvent<HTMLElement>) => void
    onPointerUp: () => void
    onPointerCancel: () => void
  }
}

/** O contextmenu veio de um dedo (o Chrome manda como PointerEvent)? */
function fromTouch(e: React.MouseEvent): boolean {
  return (e.nativeEvent as Partial<PointerEvent>).pointerType === 'touch'
}

/**
 * contextmenu da linha: se veio do toque (ou logo depois de segurar o dedo),
 * abre o "Mais" e diz que tratou; senão deixa para o menu do autor.
 */
export function touchMenuHandler(
  longPress: Pick<LongPress, 'firedRecently'>,
  openMenu: () => void
): (e: React.MouseEvent) => boolean {
  return (e) => {
    if (!fromTouch(e) && !longPress.firedRecently()) return false
    e.preventDefault()
    openMenu()
    return true
  }
}

/** O foco saiu da linha (e não foi para outro elemento dentro dela)? */
function focusLeft(e: React.FocusEvent<HTMLElement>): boolean {
  return !e.currentTarget.contains(e.relatedTarget as Node | null)
}

/** Estado da barra de ações de uma mensagem, do seletor de emoji e do menu "Mais". */
export function useMessageActionsState(): MessageActionsState {
  const [hover, setHover] = useState(false)
  const [focused, setFocused] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [longPress] = useState(() =>
    createLongPress(() => {
      setMenuOpen(true)
      // O clique do mesmo toque cairia num item do menu que abriu embaixo do dedo.
      swallowNextClick(window)
    })
  )
  return {
    showBar: hover || focused || pickerOpen || menuOpen,
    pickerOpen,
    togglePicker: () => setPickerOpen((v) => !v),
    closePicker: () => setPickerOpen(false),
    menuOpen,
    setMenuOpen,
    touchMenu: touchMenuHandler(longPress, () => setMenuOpen(true)),
    rowProps: {
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      // Só o foco do teclado (Tab): clicar no nome ou no avatar não prende a barra.
      onFocus: (e) => setFocused(e.target.matches(':focus-visible')),
      onBlur: (e) => {
        if (focusLeft(e)) setFocused(false)
      },
      onPointerDown: (e) => longPress.down(e),
      onPointerMove: (e) => longPress.move(e),
      onPointerUp: longPress.cancel,
      onPointerCancel: longPress.cancel
    }
  }
}
