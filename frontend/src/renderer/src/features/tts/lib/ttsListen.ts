import type { Message } from '../../chat/api/messages'

// Quem ouve uma mensagem /tts (docs/adr/0012-tts-no-cliente.md). Quem recebeu
// o message:create já vê o canal (ou é da DM); falta estar na call de origem
// da mensagem (o canal de voz que o backend gravou em tts_voice_channel_id, ou
// a call daquela DM), sem ensurdecer e com o interruptor "Ouvir mensagens de
// TTS" ligado. Issue #384: não basta estar numa call do mesmo servidor.

/** O pedaço do estado da call que decide se a TTS é comigo. */
export interface TTSCallView {
  status: string
  type: string | null
  serverId: string | null
  /** O canal de voz da call (type === 'channel'). */
  channelId: string | null
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
  conversation_id?: string | null
  message?: Message
}

/** A call em que estou é a de origem da mensagem? Sem origem, ninguém ouve. */
function sameCall(msg: Message, call: TTSCallView): boolean {
  if (msg.channel_id) {
    return call.type === 'channel' && !!msg.tts_voice_channel_id && msg.tts_voice_channel_id === call.channelId
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
  if (!p || !msg?.tts || !sameCall(msg, ctx.call)) return null
  return msg
}
