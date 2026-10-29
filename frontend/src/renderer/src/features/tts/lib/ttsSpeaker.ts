import { createPiperSpeaker, type PiperSpeakerDeps } from './piperEngine'
import type { TTSSpeaker } from './ttsQueue'

export interface TTSSpeakerChoice {
  /** window.api.tts: só existe no app desktop do Linux. */
  local: { speak: (text: string) => Promise<Uint8Array | null> } | undefined
  webSpeech: () => TTSSpeaker | null
  play: PiperSpeakerDeps['play']
}

/**
 * Qual motor fala o /tts: a voz Piper no app desktop do Linux (o Chromium lá
 * não tem voz sem speech-dispatcher) e a Web Speech no resto
 * (docs/adr/0014-voz-piper-no-linux.md).
 */
export function chooseTTSSpeaker(choice: TTSSpeakerChoice): TTSSpeaker | null {
  const { local } = choice
  if (!local) return choice.webSpeech()
  return createPiperSpeaker({ synthesize: (text) => local.speak(text), play: choice.play })
}
