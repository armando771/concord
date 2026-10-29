import { rawRequest, request } from '../../../shared/api/client'
import type { GuestDuration } from '../lib/guestCopy'

/** O acesso do visitante (canal permitido agora e até quando). */
export interface GuestPass {
  server_id: string
  server_name: string
  channel_id: string
  channel_name: string
  expires_at: string
  can_speak: boolean
  can_stream: boolean
}

export interface GuestPreview {
  server_name: string
  channel_name: string
  inviter_name: string
  expires_at: string
  can_speak: boolean
  can_stream: boolean
}

export interface GuestSession {
  token: string
  user: { id: string; username: string; display_name: string }
  pass: GuestPass
}

export interface GuestInviteGuest {
  user_id: string
  display_name: string
  avatar_url?: string | null
  ended_at?: string | null
}

export interface GuestInviteSummary {
  id: string
  server_id: string
  channel_id: string
  created_by: string
  expires_at: string
  can_speak: boolean
  can_stream: boolean
  guests: GuestInviteGuest[]
}

export interface CreatedGuestInvite {
  id: string
  token: string
  expires_at: string
}

export interface CreateGuestInviteInput {
  channel_id: string
  duration: GuestDuration
  can_speak: boolean
  can_stream: boolean
}

/** Prévia do link (pública: não manda login). */
export function getGuestPreview(token: string): Promise<GuestPreview> {
  return rawRequest(`/guest-invites/${token}`)
}

/** Entrar sem conta: com o nome digitado, sem token (vira a sessão de visitante). */
export function joinAsGuest(token: string, displayName: string): Promise<GuestSession> {
  return rawRequest(`/guest-invites/${token}/join`, {
    method: 'POST',
    body: JSON.stringify({ display_name: displayName })
  })
}

/** Entrar com a conta logada (sem virar membro). */
export function joinWithAccount(token: string): Promise<{ pass: GuestPass }> {
  return request(`/guest-invites/${token}/join`, { method: 'POST' })
}

/** Os acessos ativos de quem chama (depois de ser movido, o canal muda). */
export function getGuestPasses(): Promise<GuestPass[]> {
  return request('/guest/passes')
}

export function createGuestInvite(input: CreateGuestInviteInput): Promise<CreatedGuestInvite> {
  return request('/guest-invites', { method: 'POST', body: JSON.stringify(input) })
}

export function listGuestInvites(channelId: string): Promise<GuestInviteSummary[]> {
  return request(`/guest-invites?channel_id=${encodeURIComponent(channelId)}`)
}

export function revokeGuestInvite(id: string): Promise<void> {
  return request(`/guest-invites/${id}`, { method: 'DELETE' })
}

export function removeGuest(serverId: string, userId: string): Promise<void> {
  return request(`/guests/${userId}/end`, {
    method: 'POST',
    body: JSON.stringify({ server_id: serverId })
  })
}
