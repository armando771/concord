import { request } from './client'

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
  role: string
  joined_at?: string
  username?: string
  display_name?: string
  avatar_url?: string | null
  is_bot?: boolean
}

export interface GetServerResponse {
  server: Server
  members: ServerMember[]
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

/** O dono torna alguém moderador ("admin") ou membro comum. */
export async function setMemberRole(
  serverId: string,
  userId: string,
  role: 'admin' | 'member'
): Promise<ServerMember> {
  return request<ServerMember>(`/servers/${serverId}/members/${userId}/role`, {
    method: 'PUT',
    body: JSON.stringify({ role })
  })
}

/** Dono/moderador: escolhe o canal principal (avisos do servidor). */
export async function setPrimaryChannel(serverId: string, channelId: string): Promise<Server> {
  return request<Server>(`/servers/${serverId}/primary-channel`, {
    method: 'PUT',
    body: JSON.stringify({ channel_id: channelId })
  })
}
