/** Quem aparece numa chamada (o UserInfo do backend, sem os campos que o app não usa). */
export interface CallUser {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
}

export type CallKind = 'dm' | 'channel'

/**
 * idle: sem chamada · ringing: tocando para mim · outgoing: eu liguei e espero atender
 * connecting: entrando na mídia · active: falando · reconnecting: mídia caiu e tenta voltar.
 */
export type CallPhase = 'idle' | 'ringing' | 'outgoing' | 'connecting' | 'active' | 'reconnecting'

/** Mudo e fone de uma pessoa, como vêm no `call:voice` (os `server_*` foram impostos por um moderador). */
export interface VoiceState {
  muted: boolean
  deafened: boolean
  serverMuted: boolean
  serverDeafened: boolean
}

export const NO_VOICE: VoiceState = { muted: false, deafened: false, serverMuted: false, serverDeafened: false }

/** Payloads dos eventos WS `call:*` (backend/internal/call/model.go). */
export interface InvitePayload {
  call_id: string
  type: CallKind
  initiator: CallUser
  conversation_id?: string | null
  channel_id?: string | null
  server_id?: string | null
}
export interface UserPayload {
  call_id: string
  user: CallUser
}
export interface VoicePayload {
  call_id: string
  user_id: string
  muted: boolean
  deafened: boolean
  server_muted?: boolean
  server_deafened?: boolean
}
export interface MovedPayload {
  from_call_id: string
  channel_id: string
  channel_name: string
  user: CallUser
}
