// Pausa as animações CSS infinitas (pulse, ping, glow, nomes animados...) com a
// janela em segundo plano. Cada uma, rodando, obriga o Chromium a desenhar a
// janela inteira a cada quadro: CPU no renderer e GPU no processo de GPU,
// disputando com o jogo. As finitas (entrada de modal, toast) continuam: pausar
// uma no começo deixaria o elemento invisível.

/** O que o LoopPauser usa de um Animation (document.getAnimations()). */
export interface PausableAnimation {
  readonly playState: string
  readonly effect: { getTiming(): { iterations?: number } } | null
  pause(): void
  play(): void
}

export const isEndlessLoop = (a: PausableAnimation): boolean =>
  a.effect?.getTiming().iterations === Infinity

export class LoopPauser {
  private readonly paused = new Set<PausableAnimation>()

  /** Pausa as infinitas que estão rodando; pode ser chamado de novo para as que surgiram. */
  pause(animations: Iterable<PausableAnimation>): void {
    for (const a of animations) {
      if (a.playState !== 'running' || !isEndlessLoop(a)) continue
      a.pause()
      this.paused.add(a)
    }
  }

  /** Volta só as que este pauser pausou e que ainda existem (cancelada fica 'idle'). */
  resume(): void {
    for (const a of this.paused) if (a.playState === 'paused') a.play()
    this.paused.clear()
  }
}

/** Animações novas surgem com o app em segundo plano (alguém fala, chega mensagem). */
export const RESCAN_MS = 2000

/**
 * Pausa as infinitas agora e a cada `everyMs` (pega as que surgirem); a função
 * devolvida para de varrer e solta as pausadas.
 */
export function holdLoops(
  source: () => Iterable<PausableAnimation>,
  everyMs = RESCAN_MS
): () => void {
  const pauser = new LoopPauser()
  pauser.pause(source())
  const timer = setInterval(() => pauser.pause(source()), everyMs)
  return () => {
    clearInterval(timer)
    pauser.resume()
  }
}
