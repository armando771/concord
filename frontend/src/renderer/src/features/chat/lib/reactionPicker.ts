// Seletor de emoji das reações: de qual botão ele nasceu e onde fica na tela.
// Cada gatilho (o "+" ao lado dos chips e o ícone da barra de ações) abre o
// seletor na própria âncora; sem âncora, ele fica no canto da linha.

/** Seletor aberto e o botão que o abriu (null = a barra de ações, no canto da linha). */
export type ReactionPickerState<A> = { anchor: A | null } | null

/** Abre pelo gatilho `anchor`, ou fecha se já estiver aberto. */
export function toggleReactionPicker<A>(
  prev: ReactionPickerState<A>,
  anchor: A | null
): ReactionPickerState<A> {
  return prev ? null : { anchor }
}

/** Folga entre o botão e o seletor. */
const GAP = 6
/** Folga até a borda da janela. */
const MARGIN = 8
/** Menos que isto não dá para usar (busca + uma fileira e pouco). */
const MIN_HEIGHT = 140

interface Box {
  left: number
  top: number
  bottom: number
}

/** Estilo `fixed` do seletor ao lado do botão, sem sair da janela. */
export function anchoredPickerStyle(
  anchor: Box,
  picker: { width: number; height: number },
  view: { width: number; height: number }
): { left: number; top?: number; bottom?: number; maxHeight?: number } {
  const left = Math.max(MARGIN, Math.min(anchor.left, view.width - picker.width - MARGIN))
  const below = view.height - anchor.bottom - GAP - MARGIN
  const above = anchor.top - GAP - MARGIN
  const side = picker.height <= below || below >= above ? 'below' : 'above'
  const room = side === 'below' ? below : above
  const maxHeight = picker.height <= room ? {} : { maxHeight: Math.max(room, MIN_HEIGHT) }
  const edge =
    side === 'below' ? { top: anchor.bottom + GAP } : { bottom: view.height - anchor.top + GAP }
  return { left, ...edge, ...maxHeight }
}
