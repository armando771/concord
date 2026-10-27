import { useState } from 'react'

export interface MessageActionsState {
  /** A barra de ações aparece (mouse em cima ou seletor de emoji aberto). */
  showBar: boolean
  pickerOpen: boolean
  togglePicker: () => void
  closePicker: () => void
  /** Vai na linha da mensagem: liga a barra ao passar o mouse (no toque, ao tocar). */
  rowProps: {
    onMouseEnter: () => void
    onMouseLeave: () => void
  }
}

/** Estado da barra de ações de uma mensagem e do seletor de emoji das reações. */
export function useMessageActionsState(): MessageActionsState {
  const [hover, setHover] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  return {
    showBar: hover || pickerOpen,
    pickerOpen,
    togglePicker: () => setPickerOpen((v) => !v),
    closePicker: () => setPickerOpen(false),
    rowProps: {
      onMouseEnter: () => setHover(true),
      onMouseLeave: () => setHover(false)
    }
  }
}
