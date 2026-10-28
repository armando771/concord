import type { Message } from '../../chat/api/messages'

// Quem ouve uma mensagem /tts (docs/adr/0012-tts-no-cliente.md). Quem recebeu
// o message:create já vê o canal (ou é da DM); falta estar numa call ativa
// do mesmo servidor (canal) ou daquela DM, sem ensurdecer e com o
// interruptor "Ouvir mensagens de TTS" ligado.

/** O pedaço do estado da call que decide se a TTS é comigo. */
export interface TTSCallView {
  status: string
  type: string | null
  serverId: string | null
  conversationId: string | null
}

export interface TTSListenContext {
  /** "Ouvir mensagens de TTS" (Configurações → Voz). */
  enabled: boolean
  call: TTSCallView
  deafened: boolean
  /** Ensurdecido por um moderador. */
  serverDeafened: boolean
}

interface CreatePayload {
  server_id?: string
  conversation_id?: string | null
  message?: Message
}

/** A call em que estou é a da mensagem? */
function sameCall(p: CreatePayload, msg: Message, call: TTSCallView): boolean {
  if (msg.channel_id) {
    return call.type === 'channel' && !!p.server_id && p.server_id === call.serverId
  }
  return call.type === 'dm' && !!msg.conversation_id && msg.conversation_id === call.conversationId
}

/** Dá para ouvir TTS agora (em call ativa, sem ensurdecer, interruptor ligado)? */
export function canHearTTS(ctx: TTSListenContext): boolean {
  return ctx.enabled && ctx.call.status === 'active' && !ctx.deafened && !ctx.serverDeafened
}

/** A mensagem TTS a falar agora, ou null quando este evento não fala nada. */
export function ttsMessageToSpeak(
  event: { type: string; payload: unknown },
  ctx: TTSListenContext
): Message | null {
  if (event.type !== 'message:create' || !canHearTTS(ctx)) return null
  const p = event.payload as CreatePayload | null
  const msg = p?.message
  if (!p || !msg?.tts || !sameCall(p, msg, ctx.call)) return null
  return msg
}
