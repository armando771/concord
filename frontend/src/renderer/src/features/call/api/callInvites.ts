import { request } from '../../../shared/api/client'
import type { NameStyle } from '../../profile/lib/nameStyle'

export type InviteResultStatus =
  | 'sent'
  | 'already_invited'
  | 'already_in_call'
  | 'not_friend'
  | 'blocked'
  | 'offline'
  | 'busy'
  | 'no_access'
  | 'cooldown'

/** Estado final de um convite (call:friend_invite_update). */
export type InviteUpdateStatus = 'accepted' | 'declined' | 'expired' | 'cancelled'

export interface InviteResult {
  user_id: string
  status: InviteResultStatus
}

export interface InviteSender {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
  name_style?: NameStyle
}

/** Convite recebido (call:friend_invite). */
export interface ReceivedInvite {
  call_id: string
  channel_id?: string | null
  server_id?: string | null
  channel_name?: string
  server_name?: string
  by: InviteSender
  /** ISO */
  expires_at: string
}

export interface InviteUpdate {
  call_id: string
  user_id: string
  status: InviteUpdateStatus
}

/** Convida vários amigos de uma vez; o servidor valida cada um. */
export async function sendCallInvites(callId: string, userIds: string[]): Promise<InviteResult[]> {
  const res = await request<{ results: InviteResult[] }>(`/calls/${callId}/invites`, {
    method: 'POST',
    body: JSON.stringify({ user_ids: userIds })
  })
  return res.results
}

export function acceptCallInvite(callId: string): Promise<{ message: string }> {
  return request(`/calls/${callId}/invites/accept`, { method: 'POST' })
}

export function declineCallInvite(callId: string): Promise<{ message: string }> {
  return request(`/calls/${callId}/invites/decline`, { method: 'POST' })
}
