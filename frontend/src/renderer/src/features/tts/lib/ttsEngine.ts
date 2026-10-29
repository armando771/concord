import type { TTSSpeaker } from './ttsQueue'

// Motor das falas /tts: a Web Speech API (speechSynthesis) do próprio
// Chromium/Electron, com as vozes do sistema (docs/adr/0012-tts-no-cliente.md).
// No app desktop do Linux fala o piperEngine.ts (docs/adr/0014-voz-piper-no-linux.md).

interface VoiceLike {
  lang: string
  name: string
  default?: boolean
}

/** Voz em português do Brasil; senão qualquer português; senão a padrão. */
export function pickVoice<V extends VoiceLike>(voices: V[]): V | null {
  const lang = (x: V): string => x.lang.toLowerCase().replace('_', '-')
  return (
    voices.find((x) => lang(x) === 'pt-br') ??
    voices.find((x) => lang(x).startsWith('pt')) ??
    voices.find((x) => x.default) ??
    voices[0] ??
    null
  )
}

/** As vozes demoram a carregar no Chromium: espera o voiceschanged (até 1 s). */
const VOICES_WAIT_MS = 1000
/** Fala que nunca avisa o fim (bug conhecido do Chromium) não trava a fila. */
const WATCHDOG_MS = 25000

export interface WebSpeechDeps {
  synth: SpeechSynthesis | undefined
  Utterance: typeof SpeechSynthesisUtterance | undefined
  /** Volume de saída das configurações (a fala vai até 100%). */
  volume: () => number
}

function loadVoices(synth: SpeechSynthesis): Promise<SpeechSynthesisVoice[]> {
  const now = synth.getVoices()
  if (now.length > 0) return Promise.resolve(now)
  return new Promise((resolve) => {
    const done = (): void => {
      synth.removeEventListener('voiceschanged', done)
      clearTimeout(timer)
      resolve(synth.getVoices())
    }
    const timer = setTimeout(done, VOICES_WAIT_MS)
    synth.addEventListener('voiceschanged', done)
  })
}

/** O falante da Web Speech API, ou null se o navegador não tem. */
export function createWebSpeechSpeaker(deps: WebSpeechDeps): TTSSpeaker | null {
  const { synth, Utterance } = deps
  if (!synth || !Utterance) return null
  return {
    speak(text, onEnd) {
      let ended = false
      const finish = (): void => {
        if (ended) return
        ended = true
        clearTimeout(watchdog)
        onEnd()
      }
      const watchdog = setTimeout(finish, WATCHDOG_MS)
      void loadVoices(synth).then((voices) => {
        const voice = pickVoice(voices)
        if (!voice || ended) return finish()
        const u = new Utterance(text)
        u.voice = voice
        u.lang = voice.lang
        u.volume = Math.max(0, Math.min(1, deps.volume()))
        u.onend = finish
        u.onerror = finish
        synth.speak(u)
      })
    },
    cancel() {
      synth.cancel()
    }
  }
}
