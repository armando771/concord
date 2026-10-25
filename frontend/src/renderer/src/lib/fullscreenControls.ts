// Tela cheia das transmissões: regras puras (sem DOM nem React) do auto-ocultar
// da barra de controles e da separação entre clique (foco) e duplo clique.

/** Sem mexer o mouse por esse tempo, a barra some. */
export const CONTROLS_HIDE_DELAY_MS = 2500
/** Janela para o segundo clique valer como duplo clique. */
export const DOUBLE_CLICK_MS = 250

interface Timers {
  set: (fn: () => void, ms: number) => unknown
  clear: (handle: unknown) => void
}

const REAL_TIMERS: Timers = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)
}

/**
 * Visibilidade da barra: começa visível, `show()` (mouse mexeu) mostra e
 * reinicia a contagem, `hold()` (mouse em cima da barra) segura até
 * `release()`, `stop()` cancela tudo (saiu da tela cheia).
 */
export class AutoHide {
  private visible = true
  private held = false
  private handle: unknown = null

  constructor(
    private readonly onChange: (visible: boolean) => void,
    private readonly delay = CONTROLS_HIDE_DELAY_MS,
    private readonly timers: Timers = REAL_TIMERS
  ) {}

  /** Começa a contar com a barra visível (sem notificar: o estado inicial já é visível). */
  start(): void {
    this.visible = true
    this.held = false
    this.arm()
  }

  show(): void {
    this.set(true)
    this.arm()
  }

  hold(): void {
    this.held = true
    this.disarm()
    this.set(true)
  }

  release(): void {
    this.held = false
    this.arm()
  }

  stop(): void {
    this.disarm()
    this.held = false
  }

  private set(visible: boolean): void {
    if (this.visible === visible) return
    this.visible = visible
    this.onChange(visible)
  }

  private arm(): void {
    this.disarm()
    if (this.held) return
    this.handle = this.timers.set(() => {
      this.handle = null
      this.set(false)
    }, this.delay)
  }

  private disarm(): void {
    if (this.handle === null) return
    this.timers.clear(this.handle)
    this.handle = null
  }
}

/**
 * Um clique só vale (ex.: abrir o modo foco) se o segundo não vier logo em
 * seguida; o duplo clique cancela o pendente e fica só com a tela cheia.
 */
export class ClickDisambiguator {
  private handle: unknown = null

  constructor(
    private readonly delay = DOUBLE_CLICK_MS,
    private readonly timers: Timers = REAL_TIMERS
  ) {}

  /** Agenda `action` para depois da janela de duplo clique (o último clique vence). */
  click(action: () => void): void {
    this.cancel()
    this.handle = this.timers.set(() => {
      this.handle = null
      action()
    }, this.delay)
  }

  cancel(): void {
    if (this.handle === null) return
    this.timers.clear(this.handle)
    this.handle = null
  }
}

/** Duplo clique em controle (botão, slider, link) não alterna a tela cheia. */
export function isInteractiveTarget(
  target: { closest?: (selector: string) => unknown } | null
): boolean {
  return Boolean(target?.closest?.('button, input, a, select, textarea, [role="slider"]'))
}
