import { useState } from 'react'
import { toggleReactionPicker, type ReactionPickerState } from '../lib/reactionPicker'

export interface ReactionPicker {
  open: boolean
  /** Botão que abriu o seletor; null = a barra de ações (o seletor fica no canto da linha). */
  anchor: HTMLElement | null
  /** Abre pelo gatilho `anchor` (sem ele, no canto da linha) ou fecha se já aberto. */
  toggle: (anchor?: HTMLElement | null) => void
  close: () => void
}

/** Estado do seletor de emoji das reações, com a âncora de quem o abriu. */
export function useReactionPicker(): ReactionPicker {
  const [state, setState] = useState<ReactionPickerState<HTMLElement>>(null)
  return {
    open: state !== null,
    anchor: state?.anchor ?? null,
    toggle: (anchor) => setState((prev) => toggleReactionPicker(prev, anchor ?? null)),
    close: () => setState(null)
  }
}
