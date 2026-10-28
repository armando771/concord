import type { Message } from '../../chat/api/messages'
import { canHearTTS, ttsMessageToSpeak, type TTSListenContext } from './ttsListen'
import { spokenText, type SpokenNames } from './ttsText'
import type { TTSQueue } from './ttsQueue'

/** O contexto de quem ouve, mais a call atual (trocar de call esvazia a fila). */
export type TTSListenerContext = TTSListenContext & { callId: string | null }

/** O que o ouvinte lê e usa (injetado: os testes não sobem os stores). */
export interface TTSListenerDeps {
  context: () => TTSListenerContext
  /** Nomes para ler a mensagem (apelidos do servidor da call, participantes). */
  names: (msg: Message, serverId: string | null) => SpokenNames
  queue: TTSQueue
}

export interface TTSListener {
  /** Cada evento do WS. */
  onEvent: (event: { type: string; payload: unknown }) => void
  /** O estado da call ou o interruptor mudou. */
  onStateChange: () => void
}

/** Quantos ids lembrar: o message:create de canal chega pela sala do canal e do servidor. */
const SEEN_MAX = 100

export function createTTSListener(deps: TTSListenerDeps): TTSListener {
  const seen = new Set<string>()
  let callId = deps.context().callId

  return {
    onEvent(event) {
      const ctx = deps.context()
      const msg = ttsMessageToSpeak(event, ctx)
      if (!msg || seen.has(msg.id)) return
      seen.add(msg.id)
      if (seen.size > SEEN_MAX) seen.delete(seen.values().next().value!)
      deps.queue.enqueue(spokenText(msg, deps.names(msg, ctx.call.serverId)))
    },
    onStateChange() {
      const ctx = deps.context()
      if (!canHearTTS(ctx) || ctx.callId !== callId) deps.queue.clear()
      callId = ctx.callId
    }
  }
}
