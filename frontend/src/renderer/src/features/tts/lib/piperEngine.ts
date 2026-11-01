import type { TTSSpeaker } from './ttsQueue'

// Motor das falas /tts no app desktop do Linux: o main sintetiza com o Piper
// (voz baixada no primeiro uso) e o renderer toca o WAV na saída escolhida
// (docs/adr/0014-voz-piper-no-linux.md). Mesma interface da Web Speech.

export interface PiperSpeakerDeps {
  /** window.api.tts.speak: WAV, ou null (voz ainda não pronta). */
  synthesize: (text: string) => Promise<Uint8Array | null>
  /** Toca o WAV e chama onEnd no fim; devolve o "parar". */
  play: (wav: Uint8Array, onEnd: () => void) => () => void
}

/** Síntese (até 15 s no main) + fala de 200 caracteres (~15 s), com folga. */
const WATCHDOG_MS = 45_000

export function createPiperSpeaker(deps: PiperSpeakerDeps): TTSSpeaker {
  let turn = 0
  let stopPlaying: (() => void) | null = null
  const stop = (): void => {
    stopPlaying?.()
    stopPlaying = null
  }

  return {
    speak(text, onEnd) {
      const mine = ++turn
      let done = false
      const finish = (): void => {
        if (done) return
        done = true
        clearTimeout(watchdog)
        onEnd()
      }
      const watchdog = setTimeout(() => {
        if (turn === mine) stop()
        finish()
      }, WATCHDOG_MS)
      deps.synthesize(text).then((wav) => {
        if (!wav || done || turn !== mine) return finish()
        stopPlaying = deps.play(wav, finish)
      }, finish)
    },
    cancel() {
      turn++
      stop()
    }
  }
}
