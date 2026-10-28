// Fila das falas /tts: uma por vez, sem sobrepor. Numa rajada as mais antigas
// que ainda esperam caem (a voz não fica minutos atrasada).

/** Quem fala de fato (Web Speech no app; falso nos testes). */
export interface TTSSpeaker {
  /** Fala o texto e chama onEnd quando acabar (ou falhar). */
  speak: (text: string, onEnd: () => void) => void
  /** Para a fala atual. */
  cancel: () => void
}

export interface TTSQueue {
  enqueue: (text: string) => void
  /** Para a fala atual e esvazia a fila (ensurdeceu, saiu da call...). */
  clear: () => void
}

/** Quantas falas esperam, no máximo, além da que está tocando. */
export const TTS_QUEUE_MAX = 5

export function createTTSQueue(speaker: TTSSpeaker, max = TTS_QUEUE_MAX): TTSQueue {
  const waiting: string[] = []
  // Cada fala tem um número: o fim de uma fala cancelada não solta a próxima.
  let current = 0
  let speaking = false

  const next = (): void => {
    const text = waiting.shift()
    if (text === undefined) {
      speaking = false
      return
    }
    speaking = true
    const turn = ++current
    speaker.speak(text, () => {
      if (turn === current) next()
    })
  }

  return {
    enqueue(text) {
      waiting.push(text)
      if (waiting.length > max) waiting.shift()
      if (!speaking) next()
    },
    clear() {
      waiting.length = 0
      current++
      if (speaking) speaker.cancel()
      speaking = false
    }
  }
}
