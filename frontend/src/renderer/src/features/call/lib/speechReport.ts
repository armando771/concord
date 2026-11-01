// AFK em call: o servidor só conta tempo de call e XP de voz de quem falou nos
// últimos 10 minutos. Quem sabe que a pessoa está falando é o app (o anel
// verde: speakingIds), então ele avisa o servidor com "call:speaking".

/** No máximo um aviso a cada 15 s (o servidor aceita um a cada 10 s). */
export const SPEECH_REPORT_EVERY_MS = 15_000

export interface SpeechView {
  callId: string | null
  status: string
  meId: string | null
  muted: boolean
  speakingIds: string[]
}

/** Estou falando numa call ativa, sem mute. */
export function isSelfSpeaking(v: SpeechView): v is SpeechView & { callId: string } {
  if (v.status !== 'active' || !v.callId || !v.meId || v.muted) return false
  return v.speakingIds.includes(v.meId)
}

export interface SpeechReporterDeps {
  send: (callId: string) => void
  now: () => number
}

/** Decide quando avisar; `observe` pode ser chamado a cada mudança e a cada tanto. */
export function createSpeechReporter({ send, now }: SpeechReporterDeps): { observe: (v: SpeechView) => void } {
  let lastCallId: string | null = null
  let lastSentAt = -Infinity
  return {
    observe(v) {
      if (!isSelfSpeaking(v)) return
      const sameCall = v.callId === lastCallId
      if (sameCall && now() - lastSentAt < SPEECH_REPORT_EVERY_MS) return
      lastCallId = v.callId
      lastSentAt = now()
      send(v.callId)
    }
  }
}
