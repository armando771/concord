import { request } from './client'
import type { Role } from '../lib/permissions'

export interface Server {
  id: string
  name: string
  icon_url?: string
  owner_id: string
  /** Canal de texto dos avisos do servidor (ver lib/primaryChannel). */
  primary_channel_id?: string | null
  created_at?: string
  updated_at?: string
}

export interface ServerMember {
  server_id: string
  user_id: string
  /** Legado: "admin" se pode gerenciar canais. Os cargos de verdade estão em role_ids. */
  role: string
  /** Cargos do membro (sem o @everyone). */
  role_ids?: string[]
  joined_at?: string
  username?: string
  display_name?: string
  avatar_url?: string | null
}

export interface GetServerResponse {
  server: Server
  members: ServerMember[]
  /** Cargos do servidor, do mais alto para o mais baixo (o @everyone por último). */
  roles?: Role[]
}

export interface CreateServerInput {
  name: string
  icon_url?: string
}

export async function createServer(input: CreateServerInput): Promise<Server> {
  return request<Server>('/servers', {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

export async function listServers(): Promise<Server[]> {
  return request<Server[]>('/servers')
}

export async function getServer(id: string): Promise<GetServerResponse> {
  return request<GetServerResponse>(`/servers/${id}`)
}

export async function inviteMember(serverId: string, userId: string): Promise<void> {
  return request<void>(`/servers/${serverId}/invite`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId })
  })
}

export async function updateServer(serverId: string, input: CreateServerInput): Promise<Server> {
  return request<Server>(`/servers/${serverId}`, {
    method: 'PUT',
    body: JSON.stringify(input)
  })
}

export async function deleteServer(serverId: string): Promise<void> {
  return request<void>(`/servers/${serverId}`, {
    method: 'DELETE'
  })
}

/** Código de convite do servidor (qualquer membro pode ver e compartilhar). */
export async function getInviteCode(serverId: string): Promise<{ code: string }> {
  return request<{ code: string }>(`/servers/${serverId}/invite-code`)
}

/** Entra no servidor do código. Já sendo membro, só devolve o servidor. */
export async function joinServerByCode(code: string): Promise<Server> {
  return request<Server>('/invites/join', { method: 'POST', body: JSON.stringify({ code }) })
}

/** Quem tem KICK_MEMBERS expulsa o membro (ele pode voltar por convite). */
export function kickMember(serverId: string, userId: string): Promise<void> {
  return request<void>(`/servers/${serverId}/members/${userId}`, { method: 'DELETE' })
}

/** Sai do servidor (o dono não sai: apaga o servidor). */
export function leaveServer(serverId: string): Promise<void> {
  return request<void>(`/servers/${serverId}/leave`, { method: 'POST' })
}

export interface ServerBan {
  server_id: string
  user_id: string
  username: string
  display_name: string
  avatar_url?: string | null
  banned_by?: string | null
  reason?: string | null
  created_at: string
}

export function listBans(serverId: string): Promise<ServerBan[]> {
  return request<ServerBan[]>(`/servers/${serverId}/bans`)
}

/** Bane o membro (vale também para quem já saiu). */
export function banMember(serverId: string, userId: string, reason?: string): Promise<void> {
  return request<void>(`/servers/${serverId}/bans`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, reason: reason ?? '' })
  })
}

export function unbanMember(serverId: string, userId: string): Promise<void> {
  return request<void>(`/servers/${serverId}/bans/${userId}`, { method: 'DELETE' })
}

/** Dono/moderador: escolhe o canal principal (avisos do servidor). */
export async function setPrimaryChannel(serverId: string, channelId: string): Promise<Server> {
  return request<Server>(`/servers/${serverId}/primary-channel`, {
    method: 'PUT',
    body: JSON.stringify({ channel_id: channelId })
  })
}
