import { request } from './client'

export type CallType = 'dm' | 'channel'
export type CallStatus = 'ringing' | 'active' | 'ended'

export interface CallInfo {
  id: string
  type: CallType
  conversation_id?: string | null
  channel_id?: string | null
  server_id?: string | null
  initiator_id: string
  status: CallStatus
  started_at: string
  ended_at?: string | null
}

export interface CallParticipant {
  call_id: string
  user_id: string
  role: 'member' | 'presenter'
  joined_at: string
  muted?: boolean
  deafened?: boolean
  id?: string
  username?: string
  display_name?: string
  avatar_url?: string | null
}

export interface CallStateResponse {
  call: CallInfo | null
  participants: CallParticipant[]
  /** user_ids compartilhando tela neste momento (transitório) */
  screen_sharing?: string[]
}

export interface StartCallInput {
  type: CallType
  conversation_id?: string
  channel_id?: string
}

export function startCall(input: StartCallInput): Promise<CallInfo> {
  return request<CallInfo>('/calls', { method: 'POST', body: JSON.stringify(input) })
}

export function endCall(callId: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/calls/${callId}`, { method: 'DELETE' })
}

export function getCallState(callId: string): Promise<CallStateResponse> {
  return request<CallStateResponse>(`/calls/${callId}/state`)
}

export function listActiveCalls(scope: CallType, id: string): Promise<CallStateResponse> {
  return request<CallStateResponse>(`/calls/active?scope=${scope}&id=${encodeURIComponent(id)}`)
}

export function listActiveServerCalls(serverId: string): Promise<CallStateResponse[]> {
  return request<CallStateResponse[]>(
    `/calls/active?scope=server&id=${encodeURIComponent(serverId)}`
  )
}

/** Token do LiveKit para entrar na sala de mídia da chamada (só participantes). */
export function getCallToken(callId: string): Promise<{ token: string }> {
  return request<{ token: string }>(`/calls/${callId}/token`, { method: 'POST' })
}
