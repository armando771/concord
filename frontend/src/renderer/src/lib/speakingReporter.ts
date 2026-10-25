/**
 * Avisa o servidor quando você começa e para de falar (o XP de voz só conta
 * com voz captada). Começar é avisado na hora; parar só depois de `stopDelayMs`
 * de silêncio, para pausas curtas não virarem uma enxurrada de mensagens.
 */
export interface SpeakingReporter {
  update: (speaking: boolean) => void
  /** Esquece o estado sem avisar (fim da chamada). */
  reset: () => void
}

export function createSpeakingReporter(
  send: (speaking: boolean) => void,
  stopDelayMs = 1500
): SpeakingReporter {
  let reported = false
  let stopTimer: ReturnType<typeof setTimeout> | null = null

  const clearStop = (): void => {
    if (stopTimer) clearTimeout(stopTimer)
    stopTimer = null
  }

  return {
    update: (speaking) => {
      if (speaking) {
        clearStop()
        if (!reported) {
          reported = true
          send(true)
        }
        return
      }
      if (!reported || stopTimer) return
      stopTimer = setTimeout(() => {
        stopTimer = null
        reported = false
        send(false)
      }, stopDelayMs)
    },
    reset: () => {
      clearStop()
      reported = false
    }
  }
}
