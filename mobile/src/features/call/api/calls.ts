import { request } from '../../../shared/api/client'
import type { CallKind, CallUser } from '../lib/callTypes'

export interface CallInfo {
  id: string
  type: CallKind
  conversation_id?: string | null
  channel_id?: string | null
  server_id?: string | null
  initiator_id: string
  status: 'ringing' | 'active' | 'ended'
}

export interface CallParticipantInfo extends Partial<CallUser> {
  user_id: string
  muted?: boolean
  deafened?: boolean
  server_muted?: boolean
  server_deafened?: boolean
}

export interface CallStateResponse {
  call: CallInfo | null
  participants: CallParticipantInfo[]
}

export type StartCallInput = { type: 'channel'; channel_id: string } | { type: 'dm'; conversation_id: string }

export const startCall = (input: StartCallInput): Promise<CallInfo> =>
  request<CallInfo>('/calls', { method: 'POST', body: JSON.stringify(input) })

export const getCallToken = (callId: string): Promise<{ token: string }> =>
  request<{ token: string }>(`/calls/${encodeURIComponent(callId)}/token`, { method: 'POST' })

export const getCallState = (callId: string): Promise<CallStateResponse> =>
  request<CallStateResponse>(`/calls/${encodeURIComponent(callId)}/state`)

export const endCallRequest = (callId: string): Promise<{ message: string }> =>
  request<{ message: string }>(`/calls/${encodeURIComponent(callId)}`, { method: 'DELETE' })

/** A chamada tocando (ou ativa) numa DM: é como o app descobre o toque depois de abrir pelo push. */
export const getActiveDmCall = (conversationId: string): Promise<CallStateResponse> =>
  request<CallStateResponse>(`/calls/active?scope=dm&id=${encodeURIComponent(conversationId)}`)

/** Quem está em cada canal de voz do servidor. */
export const listServerCalls = (serverId: string): Promise<CallStateResponse[]> =>
  request<CallStateResponse[]>(`/calls/active?scope=server&id=${encodeURIComponent(serverId)}`)
