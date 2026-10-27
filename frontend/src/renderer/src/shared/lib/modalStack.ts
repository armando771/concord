/**
 * Quais modais estão abertos, do mais antigo ao mais novo. Só o do topo reage
 * ao Esc: com uma confirmação aberta por cima de outro modal, o Esc fecha a
 * confirmação e não os dois.
 */
export interface ModalStack {
  push: (id: string) => void
  remove: (id: string) => void
  isTop: (id: string) => boolean
  /** Algum modal aberto (quem está por baixo deixa o Esc para ele). */
  hasOpen: () => boolean
}

export function createModalStack(): ModalStack {
  let open: string[] = []
  return {
    push: (id) => {
      open = [...open, id]
    },
    remove: (id) => {
      open = open.filter((x) => x !== id)
    },
    isTop: (id) => open[open.length - 1] === id,
    hasOpen: () => open.length > 0
  }
}

/** A pilha do app (um modal registra ao abrir e sai ao fechar). */
export const modalStack = createModalStack()
