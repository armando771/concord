import { useState } from 'react'

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
  /** Vai na linha da mensagem. */
  rowProps: {
    onMouseEnter: () => void
    onMouseLeave: () => void
    onFocus: (e: React.FocusEvent<HTMLElement>) => void
    onBlur: (e: React.FocusEvent<HTMLElement>) => void
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
  return {
    showBar: hover || focused || pickerOpen || menuOpen,
    pickerOpen,
    togglePicker: () => setPickerOpen((v) => !v),
    closePicker: () => setPickerOpen(false),
    menuOpen,
    setMenuOpen,
    rowProps: {
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false),
      // Só o foco do teclado (Tab): clicar no nome ou no avatar não prende a barra.
      onFocus: (e) => setFocused(e.target.matches(':focus-visible')),
      onBlur: (e) => {
        if (focusLeft(e)) setFocused(false)
      }
    }
  }
}
