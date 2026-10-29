export interface HoverIntent {
  /** Ponteiro ou foco entrou: abre depois de `openDelay`. */
  enter(): void
  /** Ponteiro ou foco saiu: fecha depois de `closeDelay` (ou de `delay`, se passado). */
  leave(delay?: number): void
  /** Abre na hora (foco pelo teclado). */
  show(): void
  /** Fecha na hora (Escape). */
  close(): void
  /** Cancela o que estiver agendado, sem mudar o estado. */
  cancel(): void
}

/**
 * Abre e fecha um painel com atraso, para o mouse atravessar a distância até o
 * painel sem ele piscar. Cada entrada cancela a saída pendente e vice-versa.
 */
export function createHoverIntent({
  openDelay,
  closeDelay,
  onOpenChange
}: {
  openDelay: number
  closeDelay: number
  onOpenChange: (open: boolean) => void
}): HoverIntent {
  let timer: ReturnType<typeof setTimeout> | undefined
  const cancel = (): void => {
    clearTimeout(timer)
    timer = undefined
  }
  const schedule = (open: boolean, delay: number): void => {
    cancel()
    timer = setTimeout(() => {
      timer = undefined
      onOpenChange(open)
    }, delay)
  }
  return {
    enter: () => schedule(true, openDelay),
    leave: (delay) => schedule(false, delay ?? closeDelay),
    show: () => {
      cancel()
      onOpenChange(true)
    },
    close: () => {
      cancel()
      onOpenChange(false)
    },
    cancel
  }
}
